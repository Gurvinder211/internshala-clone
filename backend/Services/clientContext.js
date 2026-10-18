import { createHash } from 'crypto';
import { UAParser } from 'ua-parser-js';

/**
 * Pulls browser/OS/device info from the request's User-Agent header,
 * and the caller's IP. Location is left as a placeholder — wire up
 * a free IP-geo lookup (e.g. geoip-lite, no external calls needed)
 * when you build Feature 5, so both features share the same shape.
 */
function getClientContext(req) {
  const uaString = req.headers['user-agent'] || '';
  const parser = new UAParser(uaString);
  const result = parser.getResult();
  const browser = result.browser.name || 'unknown';
  const deviceId = req.headers['x-device-id'] || createHash('sha256').update(uaString || 'unknown-device').digest('hex');

  const ip =
    (req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
    req.socket?.remoteAddress ||
    'unknown';

  return {
    ip,
    deviceId: String(deviceId),
    isChrome: browser === 'Chrome' || browser === 'Mobile Chrome',
    browser,
    browserVersion: result.browser.version || 'unknown',
    os: result.os.name || 'unknown',
    deviceType: result.device.type || 'desktop', // ua-parser leaves this undefined for desktop
    deviceModel: result.device.model || null,
    userAgentRaw: uaString,
  };
}

export { getClientContext };