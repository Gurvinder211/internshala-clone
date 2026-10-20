import { Schema, model } from 'mongoose';

/**
 * Tracks how many posts a user has made today for the posting-limit quota.
 *
 * One document per (userId, date) pair.  The unique compound index lets us
 * safely upsert using findOneAndUpdate, and the sparse TTL index on 'date'
 * auto-expires old quota documents after 48 h so the collection stays small.
 */
const postDailyQuotaSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    date: { type: String, required: true }, // 'YYYY-MM-DD' UTC
    count: { type: Number, default: 0 },
    // TTL — let MongoDB clean up documents older than 2 days automatically.
    expiresAt: {
      type: Date,
      default: () => {
        const d = new Date();
        d.setUTCDate(d.getUTCDate() + 2);
        d.setUTCHours(0, 0, 0, 0);
        return d;
      },
    },
  },
  { timestamps: true }
);

// Unique compound index: one quota record per user per day.
// This is what makes the upsert race-safe — a duplicate will throw E11000
// which postLimits.js catches and retries without upsert.
postDailyQuotaSchema.index({ userId: 1, date: 1 }, { unique: true });

// Auto-delete documents 2 days after their expiresAt date.
postDailyQuotaSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default model('PostDailyQuota', postDailyQuotaSchema);
