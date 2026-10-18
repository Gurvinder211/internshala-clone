import LoginHistory from '../Model/LoginHistory.js';

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const OPEN_MIN = 10 * 60;
const CLOSE_MIN = 13 * 60;
const CHALLENGE_NEW_IP = false;

export function isMobileWindowOpen(now = new Date()) {
  if (process.env.MOBILE_WINDOW_BYPASS === 'true') return true;
  const ist = new Date(now.getTime() + IST_OFFSET_MS);
  const minutes = ist.getUTCHours() * 60 + ist.getUTCMinutes();
  return minutes >= OPEN_MIN && minutes < CLOSE_MIN;
}

export async function evaluateLogin(user, ctx) {
  if (ctx.deviceType === 'mobile' && !isMobileWindowOpen()) {
    return {
      allowed: false,
      code: 'MOBILE_TIME_WINDOW',
      message: 'Mobile sign-in is only available between 10:00 AM and 1:00 PM IST. Please try again in that window, or sign in from a computer.',
    };
  }

  const trusted = (user.trustedDevices || []).some((d) => d.deviceId === ctx.deviceId);
  const [seenBrowser, seenIp] = await Promise.all([
    LoginHistory.exists({ userId: user._id, status: 'SUCCESS', browser: ctx.browser, os: ctx.os, deviceType: ctx.deviceType }),
    LoginHistory.exists({ userId: user._id, status: 'SUCCESS', ip: ctx.ip }),
  ]);
  const flags = { newDevice: !trusted, newBrowser: !seenBrowser, newIp: !seenIp };

  let reason = null;
  if (ctx.isChrome) reason = 'CHROME';
  else if (flags.newDevice) reason = 'NEW_DEVICE';
  else if (CHALLENGE_NEW_IP && flags.newIp) reason = 'NEW_IP';

  return { allowed: true, otpRequired: reason !== null, reason, flags };
}
