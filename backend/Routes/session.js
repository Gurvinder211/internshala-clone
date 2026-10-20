import { Router } from 'express';
import protect, { authenticate } from '../middleware/auth.js';
import Session from '../Model/Session.js';
import { getClientContext } from '../Services/clientContext.js';
import { sendOtp, verifyOtp, OtpError } from '../Services/otpService.js';
import { startOrResumeSession, activateSession, logLoginEvent } from '../Services/sessionService.js';

const router = Router();

const maskEmail = (email) => email.replace(/^(.).*(@.*)$/, '$1***$2');
const sanitize = (user) => {
  const obj = user.toObject();
  delete obj.passwordHash;
  delete obj.__v;
  return obj;
};

const findOwnSession = (req) =>
  Session.findOne({ sessionId: String(req.headers['x-session-id'] || ''), userId: req.user._id });

router.post('/session', authenticate, async (req, res) => {
  try {
    const ctx = getClientContext(req);
    const result = await startOrResumeSession({
      user: req.user, ctx, method: req.authMethod, existingSessionId: req.headers['x-session-id'],
    });

    if (result.status === 'revoked') {
      return res.status(401).json({ message: 'This session was ended from another device.', code: 'SESSION_REVOKED' });
    }
    if (result.status === 'blocked') {
      return res.status(403).json({ status: 'blocked', code: result.code, message: result.message });
    }
    if (result.status === 'otp_required') {
      return res.json({
        status: 'otp_required', sessionId: result.session.sessionId,
        maskedEmail: maskEmail(req.user.email), cooldownSeconds: 60,
        deliveryMode: result.deliveryMode || result.session.otpDeliveryMode || 'email',
      });
    }
    res.json({ status: 'active', sessionId: result.session.sessionId, user: sanitize(req.user) });
  } catch (err) {
    if (err instanceof OtpError) return res.status(429).json({ error: err.message, code: err.code });
    console.error('start session failed:', err);
    if (err.code === 'EAUTH') {
      return res.status(503).json({
        error: 'Email provider rejected the SMTP credentials. Check SMTP_USER and use a current Gmail App Password in SMTP_PASS.',
        code: 'SMTP_AUTH_FAILED',
      });
    }
    if (err.code === 'EMAIL_NOT_CONFIGURED') {
      return res.status(503).json({
        error: 'Email verification is not configured. Set RESEND_API_KEY and EMAIL_FROM in the Render service environment.',
        code: 'EMAIL_NOT_CONFIGURED',
      });
    }
    if (err.code === 'EMAIL_FROM_NOT_CONFIGURED') {
      return res.status(503).json({
        error: 'Set EMAIL_FROM to a verified sender address for the configured email provider.',
        code: 'EMAIL_FROM_NOT_CONFIGURED',
      });
    }
    if (err.code === 'EMAIL_API_UNAVAILABLE') {
      return res.status(503).json({
        error: 'The email API could not be reached. Check Render outbound HTTPS connectivity and the provider status.',
        code: 'EMAIL_API_UNAVAILABLE',
      });
    }
    if (err.code === 'EMAIL_API_REJECTED') {
      return res.status(503).json({
        error: 'The email provider rejected the message. Check RESEND_API_KEY and confirm EMAIL_FROM is verified.',
        code: 'EMAIL_API_REJECTED',
      });
    }
    if (['ECONNECTION', 'ECONNREFUSED', 'ETIMEDOUT', 'ESOCKET'].includes(err.code)) {
      return res.status(503).json({
        error: 'The SMTP email service is unavailable. Configure RESEND_API_KEY and EMAIL_FROM, or check the SMTP host, port, and connectivity.',
        code: 'SMTP_UNAVAILABLE',
      });
    }
    res.status(500).json({ error: 'Could not start your session' });
  }
});

router.post('/session/verify-otp', authenticate, async (req, res) => {
  try {
    const ctx = getClientContext(req);
    const session = await findOwnSession(req);
    if (!session) return res.status(401).json({ error: 'Please sign in again.', code: 'SESSION_REQUIRED' });

    const done = () => res.json({ status: 'active', sessionId: session.sessionId, user: sanitize(req.user) });
    if (session.status === 'active') return done();

    if (session.status !== 'pending' || session.expiresAt <= new Date()) {
      return res.status(400).json({ error: 'This sign-in expired. Please sign in again.', code: 'SESSION_EXPIRED' });
    }

    try {
      await verifyOtp({ userId: req.user._id, purpose: 'LOGIN_VERIFY', code: req.body.code });
    } catch (err) {
      if (!(err instanceof OtpError)) throw err;

      const fresh = await Session.findById(session._id);
      if (fresh.status === 'active') return done();

      await logLoginEvent(req.user, ctx, { status: 'OTP_FAILED', sessionId: session.sessionId, method: session.method, reason: err.code });
      if (err.code === 'LOCKED') {
        await Session.updateOne({ _id: session._id, status: 'pending' }, { $set: { status: 'revoked', revokedReason: 'too many failed codes' } });
        return res.status(403).json({ error: 'Too many incorrect codes. Please sign in again.', code: 'LOCKED' });
      }
      return res.status(400).json({ error: err.message, code: err.code });
    }

    await activateSession(session, req.user, ctx);
    done();
  } catch (err) {
    console.error('verify login otp failed:', err);
    res.status(500).json({ error: 'Could not verify the code' });
  }
});

router.post('/session/resend-otp', authenticate, async (req, res) => {
  try {
    const ctx = getClientContext(req);
    const session = await findOwnSession(req);
    if (!session || session.status !== 'pending') {
      return res.status(400).json({ error: 'No sign-in in progress. Please sign in again.', code: 'SESSION_REQUIRED' });
    }
    const { cooldownSeconds, deliveryMode } = await sendOtp({ userId: req.user._id, purpose: 'LOGIN_VERIFY', sentTo: req.user.email });
    await Session.updateOne({ _id: session._id }, { $set: {
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      otpDeliveryMode: deliveryMode,
    } });
    await logLoginEvent(req.user, ctx, { status: 'OTP_SENT', sessionId: session.sessionId, method: session.method, otpRequired: true, reason: 'resend' });
    res.json({ success: true, cooldownSeconds, deliveryMode });
  } catch (err) {
    if (err instanceof OtpError) return res.status(429).json({ error: err.message, code: err.code });
    console.error('resend login otp failed:', err);
    if (err.code === 'EAUTH') {
      return res.status(503).json({
        error: 'Email provider rejected the SMTP credentials. Check SMTP_USER and use a current Gmail App Password in SMTP_PASS.',
        code: 'SMTP_AUTH_FAILED',
      });
    }
    res.status(500).json({ error: 'Could not resend the code' });
  }
});

router.get('/sessions', protect, async (req, res) => {
  const sessions = await Session.find({ userId: req.user._id, status: 'active', expiresAt: { $gt: new Date() } })
    .sort({ lastSeenAt: -1 });
  res.json({
    sessions: sessions.map((s) => ({
      id: s._id,
      browser: s.browser,
      browserVersion: s.browserVersion,
      os: s.os,
      deviceType: s.deviceType,
      deviceModel: s.deviceModel,
      ip: s.ip,
      location: s.location,
      createdAt: s.createdAt,
      lastSeenAt: s.lastSeenAt,
      current: s.sessionId === req.authSession.sessionId,
    })),
  });
});

router.post('/sessions/revoke-others', protect, async (req, res) => {
  const result = await Session.updateMany(
    { userId: req.user._id, status: 'active', _id: { $ne: req.authSession._id } },
    { $set: { status: 'revoked', revokedReason: 'signed out from another device' } }
  );
  await logLoginEvent(req.user, getClientContext(req), {
    status: 'SESSION_REVOKED', sessionId: req.authSession.sessionId, method: req.authMethod,
    reason: `signed out ${result.modifiedCount} other session(s)`,
  });
  res.json({ success: true, revoked: result.modifiedCount });
});

router.delete('/sessions/:id', protect, async (req, res) => {
  const result = await Session.updateOne(
    { _id: req.params.id, userId: req.user._id, status: 'active' },
    { $set: { status: 'revoked', revokedReason: 'signed out from another device' } }
  );
  if (!result.modifiedCount) return res.status(404).json({ error: 'Session not found' });
  await logLoginEvent(req.user, getClientContext(req), {
    status: 'SESSION_REVOKED', sessionId: req.authSession.sessionId, method: req.authMethod, reason: 'signed out one session',
  });
  res.json({ success: true });
});

router.post('/logout', protect, async (req, res) => {
  await Session.updateOne({ _id: req.authSession._id }, { $set: { status: 'revoked', revokedReason: 'logged out' } });
  await logLoginEvent(req.user, getClientContext(req), { status: 'LOGOUT', sessionId: req.authSession.sessionId, method: req.authMethod });
  res.json({ success: true });
});

router.get('/login-history', protect, async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 30, 100);
  const filter = { userId: req.user._id };
  if (req.query.before) filter.createdAt = { $lt: new Date(String(req.query.before)) };
  const logs = await (await import('../Model/LoginHistory.js')).default.find(filter).sort({ createdAt: -1 }).limit(limit).select('-__v');
  res.json({ history: logs });
});

export default router;
