import { createHash } from 'crypto';
import { UAParser } from 'ua-parser-js';
import geoip from 'geoip-lite';

const normalizeIp = (ip = '') => ip.replace(/^::ffff:/, '').replace(/^::1$/, '127.0.0.1');

function describeLocation(ip) {
  if (!ip || ip === 'unknown') return 'Unknown';
  if (/^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(ip)) return 'Local network';
  const location = geoip.lookup(ip);
  return location ? [location.city, location.region, location.country].filter(Boolean).join(', ') : 'Unknown';
}

function getClientContext(req) {
  const uaString = req.headers['user-agent'] || '';
  const parser = new UAParser(uaString);
  const result = parser.getResult();
  const browser = result.browser.name || 'unknown';
  const deviceId = String(req.headers['x-device-id'] || createHash('sha256').update(uaString || 'unknown-device').digest('hex')).slice(0, 64);
  const ip = normalizeIp(req.ip || req.socket?.remoteAddress || 'unknown');

  return {
    ip,
    location: describeLocation(ip),
    deviceId,
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