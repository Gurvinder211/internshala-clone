import { Schema, model } from 'mongoose';

const resumeDownloadSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  resumeId: { type: Schema.Types.ObjectId, ref: 'Resume', required: true },
  ip: String,
  browser: String,
  os: String,
  deviceType: String,
}, { timestamps: true });

resumeDownloadSchema.index({ userId: 1, createdAt: -1 });

export default model('ResumeDownload', resumeDownloadSchema);
