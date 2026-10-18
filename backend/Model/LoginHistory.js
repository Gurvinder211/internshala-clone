import { Schema, model } from 'mongoose';

const loginHistorySchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  sessionId: String,
  status: {
    type: String, required: true,
    enum: ['SUCCESS', 'OTP_SENT', 'OTP_VERIFIED', 'OTP_FAILED', 'FAILED_PASSWORD',
      'BLOCKED_TIME_WINDOW', 'LOGOUT', 'SESSION_REVOKED'],
  },
  method: { type: String, enum: ['google', 'password'] },
  reason: String,
  otpRequired: Boolean,
  newDevice: Boolean, newBrowser: Boolean, newIp: Boolean,

  ip: String, location: String,
  browser: String, browserVersion: String, os: String, deviceType: String, deviceModel: String,
}, { timestamps: true });

loginHistorySchema.index({ userId: 1, createdAt: -1 });

export default model('LoginHistory', loginHistorySchema);
