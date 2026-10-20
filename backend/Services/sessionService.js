import crypto from 'crypto';
import Session from '../Model/Session.js';
import LoginHistory from '../Model/LoginHistory.js';
import User from '../Model/User.js';
import { sendOtp } from './otpService.js';
import { evaluateLogin } from './loginPolicy.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const SESSION_DAYS = 7;
const PENDING_MINUTES = 30;
const MAX_ACTIVE_SESSIONS = 5;

const newSessionId = () => crypto.randomBytes(24).toString('hex');

export async function logLoginEvent(userOrId, ctx, fields) {
  try {
    await LoginHistory.create({
      userId: userOrId?._id || userOrId,
      ip: ctx.ip,
      location: ctx.location,
      browser: ctx.browser,
      browserVersion: ctx.browserVersion,
      os: ctx.os,
      deviceType: ctx.deviceType,
      deviceModel: ctx.deviceModel,
      ...fields,
    });
  } catch (err) {
    console.error('login history write failed:', err.message);
  }
}

async function trustDevice(userId, ctx) {
  const entry = { deviceId: ctx.deviceId, deviceName: `${ctx.browser} on ${ctx.os}`, lastUsedAt: new Date() };
  await User.updateOne({ _id: userId }, { $pull: { trustedDevices: { deviceId: ctx.deviceId } } });
  await User.updateOne({ _id: userId }, { $push: { trustedDevices: { $each: [entry], $slice: -10 } } });
}

async function trimSessions(userId, keepSessionId) {
  const active = await Session.find({ userId, status: 'active', expiresAt: { $gt: new Date() } }).sort({ lastSeenAt: 1 });
  const excess = active.length - MAX_ACTIVE_SESSIONS;
  if (excess <= 0) return;

  const victims = active.filter((s) => s.sessionId !== keepSessionId).slice(0, excess);
  await Session.updateMany(
    { _id: { $in: victims.map((v) => v._id) } },
    { $set: { status: 'revoked', revokedReason: 'too many active sessions' } }
  );
}

export async function startOrResumeSession({ user, ctx, method, existingSessionId }) {
  const now = new Date();

  if (existingSessionId) {
    const existing = await Session.findOne({ sessionId: String(existingSessionId), userId: user._id });
    if (existing?.status === 'revoked') return { status: 'revoked' };
    if (existing && existing.expiresAt > now) {
      if (existing.status === 'active') return { status: 'active', session: existing };
      if (existing.status === 'pending') {
        if (method === 'google') {
          const decision = await evaluateLogin(user, ctx, method);
          if (!decision.allowed) {
            await logLoginEvent(user, ctx, { status: 'BLOCKED_TIME_WINDOW', method, reason: decision.code });
            return { status: 'blocked', code: decision.code, message: decision.message };
          }
          const session = await activateSession(existing, user, ctx, { method, otpVerified: false });
          return { status: 'active', session };
        }
        const deliveryMode = existing.otpDeliveryMode || (process.env.SMTP_HOST ? 'email' : 'console');
        return { status: 'otp_required', session: existing, deliveryMode };
      }
    }
  }

  const decision = await evaluateLogin(user, ctx, method);
  if (!decision.allowed) {
    await logLoginEvent(user, ctx, { status: 'BLOCKED_TIME_WINDOW', method, reason: decision.code });
    return { status: 'blocked', code: decision.code, message: decision.message };
  }

  await Session.updateMany(
    { userId: user._id, deviceId: ctx.deviceId, status: 'pending', expiresAt: { $lte: now } },
    { $set: { status: 'expired' } }
  );

  const base = {
    userId: user._id, sessionId: newSessionId(), deviceId: ctx.deviceId, method,
    ip: ctx.ip, location: ctx.location,
    browser: ctx.browser, browserVersion: ctx.browserVersion,
    os: ctx.os, deviceType: ctx.deviceType, deviceModel: ctx.deviceModel,
    flags: decision.flags,
  };

  if (!decision.otpRequired) {
    const session = await Session.create({ ...base, status: 'active', expiresAt: new Date(now.getTime() + SESSION_DAYS * DAY_MS) });
    await trustDevice(user._id, ctx);
    await trimSessions(user._id, session.sessionId);
    await logLoginEvent(user, ctx, { status: 'SUCCESS', sessionId: session.sessionId, method, otpRequired: false, ...decision.flags });
    return { status: 'active', session };
  }

  let session;
  try {
    session = await Session.create({ ...base, status: 'pending', expiresAt: new Date(now.getTime() + PENDING_MINUTES * 60 * 1000) });
  } catch (err) {
    if (err.code !== 11000) throw err;
    const pending = await Session.findOne({ userId: user._id, deviceId: ctx.deviceId, status: 'pending' });
    if (pending) return { status: 'otp_required', session: pending };
    throw err;
  }

  let deliveryMode;
  try {
    ({ deliveryMode } = await sendOtp({ userId: user._id, purpose: 'LOGIN_VERIFY', sentTo: user.email }));
    await Session.updateOne({ _id: session._id }, { $set: { otpDeliveryMode: deliveryMode } });
    session.otpDeliveryMode = deliveryMode;
  } catch (err) {
    await Session.deleteOne({ _id: session._id });
    throw err;
  }

  await logLoginEvent(user, ctx, {
    status: 'OTP_SENT', sessionId: session.sessionId, method, otpRequired: true, reason: decision.reason, ...decision.flags,
  });
  return { status: 'otp_required', session, deliveryMode };
}

export async function activateSession(session, user, ctx, { method = session.method, otpVerified = true } = {}) {
  const now = new Date();
  const activated = await Session.findOneAndUpdate(
    { _id: session._id, status: 'pending' },
    { $set: { status: 'active', method, lastSeenAt: now, expiresAt: new Date(now.getTime() + SESSION_DAYS * DAY_MS) } },
    { new: true }
  );
  if (!activated) return Session.findById(session._id);

  await trustDevice(user._id, ctx);
  await trimSessions(user._id, activated.sessionId);
  const flags = activated.flags?.toObject?.() ?? activated.flags ?? {};
  const common = { sessionId: activated.sessionId, method: activated.method, otpRequired: otpVerified, ...flags };
  if (otpVerified) await logLoginEvent(user, ctx, { status: 'OTP_VERIFIED', ...common });
  await logLoginEvent(user, ctx, { status: 'SUCCESS', ...common });
  return activated;
}
