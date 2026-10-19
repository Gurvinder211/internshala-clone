import { Schema, model } from 'mongoose';

const sessionSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  sessionId: { type: String, required: true, unique: true },
  deviceId: { type: String, required: true },
  status: { type: String, enum: ['pending', 'active', 'revoked', 'expired'], default: 'pending' },
  method: { type: String, enum: ['google', 'password'] },
  otpDeliveryMode: { type: String, enum: ['email', 'console'] },

  ip: String, location: String,
  browser: String, browserVersion: String, os: String, deviceType: String, deviceModel: String,
  flags: { newDevice: Boolean, newBrowser: Boolean, newIp: Boolean },

  lastSeenAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, required: true },
  revokedReason: String,
}, { timestamps: true });

sessionSchema.index({ userId: 1, deviceId: 1 }, { unique: true, partialFilterExpression: { status: 'pending' } });
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 30 });

export default model('Session', sessionSchema);
