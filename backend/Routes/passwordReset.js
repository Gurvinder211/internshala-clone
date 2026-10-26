import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import User from '../Model/User.js';
import PasswordResetLog from '../Model/PasswordResetLog.js';
import protect from '../middleware/auth.js';
import { sendOtp, verifyOtp, OtpError } from '../Services/otpService.js';
import { generateResetPassword, hashPassword } from '../Services/passwordService.js';
import { getClientContext } from '../Services/clientContext.js';
import { sendMail } from '../Services/mailer.js';
import { sendSms } from '../Services/sms.js';
import { normalizePhone } from '../Services/phone.js';

const router = Router();
const RESET_COOLDOWN_HOURS = 24;
const resetLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20 });

const readInput = (body) => ({
  method: body.method === 'sms' ? 'sms' : 'email',
  identifier: body.identifier ?? body.email,
});

async function findUser(method, identifier) {
  if (method === 'sms') {
    const phone = normalizePhone(identifier);
    return phone ? User.findOne({ phone }) : null;
  }
  const email = String(identifier || '').toLowerCase().trim();
  return email ? User.findOne({ email }) : null;
}

const devFlag = (mode) => mode === 'console' ? { deliveryMode: 'console' } : {};

router.post('/request', resetLimiter, async (req, res) => {
  try {
    const { method, identifier } = readInput(req.body);
    if (!identifier) {
      return res.status(400).json({ error: method === 'sms' ? 'Mobile number is required' : 'Email is required' });
    }
    if (method === 'sms' && !normalizePhone(identifier)) {
      return res.status(400).json({ error: 'Enter a valid mobile number, e.g. +91 98765 43210' });
    }

    const genericOk = (extra = {}) => res.status(200).json({
      success: true,
      message: extra.deliveryMode === 'console'
        ? 'Demo SMS mode is active. The code is available in the server logs for the configured test number.'
        : `If an account matches, a reset code has been sent${method === 'sms' ? ' by SMS' : ' to that email'}.`,
      ...extra,
    });
    const user = await findUser(method, identifier);
    if (!user) return genericOk();

    const since = new Date(Date.now() - RESET_COOLDOWN_HOURS * 60 * 60 * 1000);
    const recentRequest = await PasswordResetLog.findOne({
      userId: user._id,
      deliveryFailed: { $ne: true },
      createdAt: { $gte: since },
    }).sort({ createdAt: -1 });
    if (recentRequest) {
      return res.status(429).json({ error: 'You can use this option only once per day.', code: 'DAILY_LIMIT' });
    }

    const requestAt = new Date();
    const reservedUser = await User.findOneAndUpdate({
      _id: user._id,
      $and: [
        { $or: [{ lastPasswordResetRequestedAt: null }, { lastPasswordResetRequestedAt: { $lt: since } }] },
        { $or: [{ lastPasswordResetAt: null }, { lastPasswordResetAt: { $lt: since } }] },
      ],
    }, { $set: { lastPasswordResetRequestedAt: requestAt } }, { new: true });
    if (!reservedUser) {
      return res.status(429).json({ error: 'You can use this option only once per day.', code: 'DAILY_LIMIT' });
    }

    try {
      const { deliveryMode } = await sendOtp({
        userId: user._id,
        purpose: 'PASSWORD_RESET',
        sentTo: method === 'sms' ? user.phone : user.email,
        channel: method,
        locale: user.language || 'en',
      });
      await PasswordResetLog.create({ userId: user._id, method, verified: false, ...getClientContext(req) });
      return genericOk(devFlag(deliveryMode));
    } catch (error) {
      await User.updateOne({ _id: user._id, lastPasswordResetRequestedAt: requestAt }, { $set: { lastPasswordResetRequestedAt: null } });
      throw error;
    }
  } catch (err) {
    if (err instanceof OtpError) return res.status(429).json({ error: err.message, code: err.code });
    console.error('password-reset request failed:', err);
    res.status(500).json({ error: 'Could not process request' });
  }
});

router.post('/verify', resetLimiter, async (req, res) => {
  try {
    const { method, identifier } = readInput(req.body);
    const { code } = req.body;
    if (!identifier || !code) return res.status(400).json({ error: 'Details and code are required' });

    const user = await findUser(method, identifier);
    if (!user) return res.status(400).json({ error: 'Invalid code' });
    await verifyOtp({
      userId: user._id,
      purpose: 'PASSWORD_RESET',
      code,
      channel: method,
      sentTo: method === 'sms' ? user.phone : user.email,
    });

    const newPassword = generateResetPassword();
    let delivery;
    try {
      delivery = method === 'sms'
        ? await sendSms({ to: user.phone, text: `InternArea: your temporary password is ${newPassword}. You'll be asked to change it after you sign in.` })
        : await sendMail({
            to: user.email,
            subject: 'Your new password',
            text: `Your password has been reset. Your new temporary password is:\n\n${newPassword}\n\nYou'll be asked to change it right after you log in. If you didn't request this, contact support immediately.`,
            html: `<p>Your password has been reset. Your new temporary password is:</p><h2 style="letter-spacing:2px">${newPassword}</h2><p>You'll be asked to change it right after you log in. If you didn't request this, contact support immediately.</p>`,
          });
    } catch (deliveryError) {
      console.error('password delivery failed:', deliveryError);
      await PasswordResetLog.findOneAndUpdate(
        { userId: user._id, method, verified: false },
        { $set: { deliveryFailed: true } },
        { sort: { createdAt: -1 } }
      );
      await User.updateOne({ _id: user._id }, { $set: { lastPasswordResetRequestedAt: null } });
      return res.status(502).json({ error: "We couldn't deliver your new password. Nothing was changed. Please request a new code." });
    }

    user.passwordHash = await hashPassword(newPassword);
    user.mustChangePassword = true;
    user.lastPasswordResetAt = new Date();
    if (user.authProvider === 'google') user.authProvider = 'local';
    await user.save();

    await PasswordResetLog.findOneAndUpdate(
      { userId: user._id, verified: false },
      { $set: { verified: true } },
      { sort: { createdAt: -1 } }
    );

    res.status(200).json({
      success: true,
      message: delivery.deliveryMode === 'console'
        ? 'Demo SMS mode is active. The temporary password is available in the server logs.'
        : method === 'sms' ? 'A new password has been sent to your mobile number by SMS.' : 'A new password has been sent to your email.',
      ...devFlag(delivery.deliveryMode),
    });
  } catch (err) {
    if (err instanceof OtpError) return res.status(400).json({ error: err.message, code: err.code });
    console.error('password-reset verify failed:', err);
    res.status(500).json({ error: 'Could not reset password' });
  }
});

router.get('/history', protect, async (req, res) => {
  try {
    const logs = await PasswordResetLog.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .limit(50)
      .select('-__v');
    res.status(200).json({ history: logs });
  } catch (err) {
    console.error('password-reset history failed:', err);
    res.status(500).json({ error: 'Could not load password reset history' });
  }
});

export default router;
