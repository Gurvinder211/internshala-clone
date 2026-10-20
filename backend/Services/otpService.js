import { randomInt, createHash } from 'crypto';
import Otp from '../Model/Otp.js';
import { sendMail } from './mailer.js';
import { sendSms } from './sms.js';

const OTP_LENGTH = 6;
const OTP_TTL_MINUTES = 10;
const RESEND_COOLDOWN_SECONDS = 60;
const DAILY_CAPS = { LOGIN_VERIFY: 30 };
const DEFAULT_DAILY_CAP = 5;
const MAX_VERIFY_ATTEMPTS = 5;

// ---------------------------------------------------------------------------
// Localised OTP email copy
// Each purpose maps to an object keyed by locale code; falls back to 'en'.
// ---------------------------------------------------------------------------
const PURPOSE_COPY = {
  LANGUAGE_CHANGE: {
    en: { subject: 'Confirm your language change', line: 'Use this code to confirm switching your site language to French:' },
    es: { subject: 'Confirma el cambio de idioma', line: 'Usa este código para confirmar el cambio de idioma a francés:' },
    hi: { subject: 'भाषा परिवर्तन की पुष्टि करें', line: 'फ्रेंच में भाषा बदलने की पुष्टि के लिए इस कोड का उपयोग करें:' },
    pt: { subject: 'Confirme a alteração de idioma', line: 'Use este código para confirmar a mudança de idioma para francês:' },
    zh: { subject: '确认语言更改', line: '请使用此验证码确认将网站语言切换为法语：' },
    fr: { subject: 'Confirmez votre changement de langue', line: 'Utilisez ce code pour confirmer le passage de la langue du site au français :' },
  },
  RESUME_PAYMENT: {
    en: { subject: "Verify it's you before payment", line: 'Use this code to verify your identity before we open the payment step:' },
    es: { subject: 'Verifica tu identidad antes del pago', line: 'Usa este código para verificar tu identidad antes de abrir el paso de pago:' },
    hi: { subject: 'भुगतान से पहले पहचान सत्यापित करें', line: 'भुगतान चरण खोलने से पहले अपनी पहचान सत्यापित करने के लिए इस कोड का उपयोग करें:' },
    pt: { subject: 'Verifique sua identidade antes do pagamento', line: 'Use este código para verificar sua identidade antes de abrirmos a etapa de pagamento:' },
    zh: { subject: '支付前验证您的身份', line: '请使用此验证码在我们打开付款步骤之前验证您的身份：' },
    fr: { subject: 'Vérifiez votre identité avant le paiement', line: "Utilisez ce code pour vérifier votre identité avant l'ouverture de l'étape de paiement :" },
  },
  PASSWORD_RESET: {
    en: { subject: 'Reset your password', line: 'Use this code to verify your identity and reset your password:' },
    es: { subject: 'Restablece tu contraseña', line: 'Usa este código para verificar tu identidad y restablecer tu contraseña:' },
    hi: { subject: 'अपना पासवर्ड रीसेट करें', line: 'अपनी पहचान सत्यापित करने और पासवर्ड रीसेट करने के लिए इस कोड का उपयोग करें:' },
    pt: { subject: 'Redefina sua senha', line: 'Use este código para verificar sua identidade e redefinir sua senha:' },
    zh: { subject: '重置您的密码', line: '请使用此验证码验证您的身份并重置密码：' },
    fr: { subject: 'Réinitialisez votre mot de passe', line: 'Utilisez ce code pour vérifier votre identité et réinitialiser votre mot de passe :' },
  },
  LOGIN_VERIFY: {
    en: { subject: 'Verify this sign-in', line: 'Use this code to verify this login:' },
    es: { subject: 'Verifica este inicio de sesión', line: 'Usa este código para verificar este inicio de sesión:' },
    hi: { subject: 'इस साइन-इन को सत्यापित करें', line: 'इस लॉगिन को सत्यापित करने के लिए इस कोड का उपयोग करें:' },
    pt: { subject: 'Verifique este login', line: 'Use este código para verificar este login:' },
    zh: { subject: '验证此次登录', line: '请使用此验证码验证本次登录：' },
    fr: { subject: 'Vérifiez cette connexion', line: 'Utilisez ce code pour vérifier cette connexion :' },
  },
};

/** Resolve copy for a given purpose + locale, falling back to English. */
function getCopy(purpose, locale) {
  const purposeMap = PURPOSE_COPY[purpose];
  if (!purposeMap) return null;
  return purposeMap[locale] || purposeMap['en'];
}

function generateCode() {
  // crypto.randomInt, not Math.random — this gates payments and password
  // resets, so it needs to be non-predictable.
  return randomInt(0, 10 ** OTP_LENGTH).toString().padStart(OTP_LENGTH, '0');
}

function hashCode(code) {
  return createHash('sha256').update(code).digest('hex');
}

class OtpError extends Error {
  constructor(message, code) {
    super(message);
    this.code = code; // machine-readable reason, for the route to map to a status
  }
}

/**
 * Request a new OTP for a user + purpose. Enforces resend cooldown and a
 * daily cap so this can't be used to spam a mailbox or brute-force cost.
 *
 * @param {object} opts
 * @param {string} opts.userId
 * @param {string} opts.purpose   - One of the keys in PURPOSE_COPY
 * @param {string} opts.sentTo    - Email address or phone number
 * @param {string} [opts.channel] - 'email' (default) or 'sms'
 * @param {string} [opts.locale]  - BCP-47 language code, e.g. 'fr', 'hi'
 */
async function sendOtp({ userId, purpose, sentTo, channel = 'email', locale = 'en' }) {
  const copy = getCopy(purpose, locale);
  if (!copy) {
    throw new OtpError('Unknown OTP purpose', 'INVALID_PURPOSE');
  }
  if (!sentTo) {
    throw new OtpError('No destination address on file', 'NO_DESTINATION');
  }

  const since = new Date(Date.now() - RESEND_COOLDOWN_SECONDS * 1000);
  const recent = await Otp.findOne({ userId, purpose, consumed: false, createdAt: { $gte: since } })
    .sort({ createdAt: -1 });
  if (recent) {
    const waitMs = RESEND_COOLDOWN_SECONDS * 1000 - (Date.now() - recent.createdAt.getTime());
    throw new OtpError(
      `Please wait ${Math.ceil(waitMs / 1000)}s before requesting another code`,
      'COOLDOWN'
    );
  }

  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const countToday = await Otp.countDocuments({ userId, purpose, createdAt: { $gte: dayAgo } });
  if (countToday >= (DAILY_CAPS[purpose] ?? DEFAULT_DAILY_CAP)) {
    throw new OtpError('Too many code requests today. Try again tomorrow.', 'DAILY_CAP');
  }

  // Invalidate any still-live OTP for this exact purpose so only the
  // newest code can ever be verified.
  await Otp.updateMany(
    { userId, purpose, consumed: false },
    { $set: { consumed: true } }
  );

  const code = generateCode();
  const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);

  await Otp.create({
    userId,
    purpose,
    sentTo,
    channel,
    codeHash: hashCode(code),
    expiresAt,
  });

  let deliveryMode = channel === 'email' ? 'email' : 'sms';
  try {
    if (channel === 'sms') {
      const delivery = await sendSms({ to: sentTo, text: `InternArea: ${copy.line} ${code}. Expires in ${OTP_TTL_MINUTES} min.` });
      deliveryMode = delivery.deliveryMode;
    } else {
      const delivery = await sendMail({
        to: sentTo,
        subject: copy.subject,
        text: `${copy.line}\n\n${code}\n\nThis code expires in ${OTP_TTL_MINUTES} minutes. If you didn't request this, ignore this email.`,
        html: `<p>${copy.line}</p><h2 style="letter-spacing:4px">${code}</h2><p>This code expires in ${OTP_TTL_MINUTES} minutes. If you didn't request this, ignore this email.</p>`,
      });
      deliveryMode = delivery.deliveryMode;
    }
  } catch (error) {
    await Otp.updateOne({ userId, purpose, consumed: false, createdAt: { $gte: since } }, { $set: { consumed: true } });
    throw error;
  }

  return { expiresAt, cooldownSeconds: RESEND_COOLDOWN_SECONDS, deliveryMode };
}

/**
 * Verify a submitted code. Throws with a specific error code on every
 * failure path so the route can return the right message without leaking
 * which part of the check failed to an attacker.
 */
async function verifyOtp({ userId, purpose, code, channel, sentTo }) {
  const otp = await Otp.findOne({
    userId,
    purpose,
    consumed: false,
    ...(channel ? { channel } : {}),
    ...(sentTo ? { sentTo } : {}),
  })
    .sort({ createdAt: -1 });

  if (!otp) {
    throw new OtpError('No active code found. Request a new one.', 'NOT_FOUND');
  }

  if (otp.expiresAt.getTime() < Date.now()) {
    otp.consumed = true;
    await otp.save();
    throw new OtpError('Code expired. Request a new one.', 'EXPIRED');
  }

  if (otp.attempts >= MAX_VERIFY_ATTEMPTS) {
    otp.consumed = true;
    await otp.save();
    throw new OtpError('Too many incorrect attempts. Request a new one.', 'LOCKED');
  }

  if (otp.codeHash !== hashCode(String(code))) {
    otp.attempts += 1;
    await otp.save();
    const remaining = MAX_VERIFY_ATTEMPTS - otp.attempts;
    throw new OtpError(
      remaining > 0 ? `Incorrect code. ${remaining} attempt(s) left.` : 'Incorrect code.',
      'MISMATCH'
    );
  }

  otp.consumed = true;
  await otp.save();
  return true; // caller proceeds with whatever the OTP was gating
}

export { sendOtp, verifyOtp, OtpError };