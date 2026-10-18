import admin from 'firebase-admin';
import jwt from 'jsonwebtoken';
import User from '../Model/User.js';
import Session from '../Model/Session.js';
import { ensureUsername } from '../Services/username.js';
import { isMobileWindowOpen } from '../Services/loginPolicy.js';

const JWT_SECRET = process.env.JWT_SECRET;
const ENFORCE_MOBILE_WINDOW_ON_ACTIVE_SESSIONS = false;

async function identify(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.split(' ')[1];

  let user = await tryFirebase(token);
  let method = 'google';
  if (!user) {
    user = await tryLocalJwt(token);
    method = 'password';
  }
  if (!user) return null;

  if (!user.username) {
    try {
      await ensureUsername(user);
    } catch (err) {
      console.warn('username assignment skipped:', err.message);
    }
  }

  return { user, method };
}

export const authenticate = async (req, res, next) => {
  try {
    const found = await identify(req);
    if (!found) return res.status(401).json({ message: 'Unauthorized: Invalid token.', code: 'INVALID_TOKEN' });
    req.user = found.user;
    req.authMethod = found.method;
    next();
  } catch (error) {
    console.error('Auth Middleware Error:', error);
    res.status(401).json({ message: 'Unauthorized: Invalid token.', code: 'INVALID_TOKEN' });
  }
};

const protect = async (req, res, next) => {
  try {
    const found = await identify(req);
    if (!found) return res.status(401).json({ message: 'Unauthorized: Invalid token.', code: 'INVALID_TOKEN' });

    const sid = req.headers['x-session-id'];
    const session = sid ? await Session.findOne({ sessionId: String(sid), userId: found.user._id }) : null;

    if (!session) return res.status(401).json({ message: 'Please sign in again.', code: 'SESSION_REQUIRED' });
    if (session.status === 'revoked') return res.status(401).json({ message: 'This session was ended from another device.', code: 'SESSION_REVOKED' });
    if (session.status !== 'active') return res.status(401).json({ message: 'Finish verifying your sign-in first.', code: 'SESSION_NOT_ACTIVE' });
    if (session.expiresAt <= new Date()) return res.status(401).json({ message: 'Your session expired.', code: 'SESSION_EXPIRED' });

    if (ENFORCE_MOBILE_WINDOW_ON_ACTIVE_SESSIONS && session.deviceType === 'mobile' && !isMobileWindowOpen()) {
      return res.status(403).json({ message: 'Mobile access is only available 10:00 AM to 1:00 PM IST.', code: 'MOBILE_TIME_WINDOW' });
    }

    if (Date.now() - session.lastSeenAt.getTime() > 60_000) {
      Session.updateOne({ _id: session._id }, { $set: { lastSeenAt: new Date() } }).catch(() => {});
    }

    req.user = found.user;
    req.authSession = session;
    req.authMethod = found.method;
    next();
  } catch (error) {
    console.error('Auth Middleware Error:', error);
    res.status(401).json({ message: 'Unauthorized: Invalid token.', code: 'INVALID_TOKEN' });
  }
};

async function tryFirebase(token) {
  try {
    const decoded = await admin.auth().verifyIdToken(token);
    const { uid, name, email, email_verified, picture } = decoded;
    const normalizedEmail = email.toLowerCase();

    let user = await User.findOne({ firebaseUid: uid });
    if (!user) {
      user = await User.findOneAndUpdate(
        { email: normalizedEmail },
        {
          $setOnInsert: { authProvider: 'google', passwordHash: null, mustChangePassword: false },
          $set: {
            firebaseUid: uid,
            name: name || normalizedEmail.split('@')[0],
            emailVerified: email_verified || false,
            photo: picture || null,
          },
        },
        { new: true, upsert: true, runValidators: true }
      );
    } else {
      const changed =
        (name && user.name !== name) ||
        user.emailVerified !== !!email_verified ||
        (picture && user.photo !== picture);
      if (changed) {
        user.name = name || user.name;
        user.emailVerified = email_verified || user.emailVerified;
        user.photo = picture || user.photo;
        await user.save();
      }
    }
    return user;
  } catch {
    return null; // not a valid Firebase token — let the JWT path try
  }
}

async function tryLocalJwt(token) {
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(payload.sub);
    return user || null;
  } catch {
    return null; // not a valid local token either — caller returns 401
  }
}

export default protect;