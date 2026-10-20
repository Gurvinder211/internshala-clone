import Post from '../Model/Post.js';
import PostDailyQuota from '../Model/PostDailyQuota.js';

// upper bound of each bracket -> posts/day allowed; Infinity for >10 friends
const TIERS = [
  { maxFriends: 0, limit: 0 },
  { maxFriends: 1, limit: 1 },
  { maxFriends: 5, limit: 2 },
  { maxFriends: 10, limit: 5 },
  { maxFriends: Infinity, limit: Infinity },
];

export function dailyLimitFor(friendCount) {
  return TIERS.find((t) => friendCount <= t.maxFriends).limit;
}

function todayUTCString() {
  return new Date().toISOString().slice(0, 10); // 'YYYY-MM-DD'
}

/**
 * Atomically checks and reserves one post slot for today.
 *
 * Why not countDocuments?  countDocuments + create is a TOCTOU race:
 * two concurrent requests can both see "used < limit" and both succeed.
 *
 * Instead we upsert a PostDailyQuota document with a conditional $inc:
 *   - If count < limit  → increment the counter and grant the slot.
 *   - If count >= limit → the filter doesn't match, update returns null → deny.
 *
 * The upsert creates the document on the first post of the day (count=1).
 *
 * IMPORTANT: If you call canPostToday and get `allowed: true` but later
 * decide not to create the post (duplicate detected, DB error, validation
 * failure, etc.), you MUST call releasePostSlot to undo the reservation.
 */
export async function canPostToday(userId, friendCount) {
  const limit = dailyLimitFor(friendCount);
  if (limit === Infinity) return { allowed: true, limit, used: null };
  if (limit === 0) return { allowed: false, limit, used: 0 };

  const today = todayUTCString();

  // Try to atomically increment the quota counter.
  // The filter `count: { $lt: limit }` ensures the increment only happens
  // when the user still has capacity.
  const doc = await PostDailyQuota.findOneAndUpdate(
    { userId, date: today, count: { $lt: limit } },
    { $inc: { count: 1 } },
    {
      new: true,        // return updated doc (so we can read the new count)
      upsert: true,     // create on first post of the day
      setDefaultsOnInsert: true,
    }
  ).catch(async (err) => {
    // E11000 duplicate-key on the upsert means another request just created
    // the document; retry once without upsert so we get the correct count.
    if (err.code === 11000) {
      return PostDailyQuota.findOneAndUpdate(
        { userId, date: today, count: { $lt: limit } },
        { $inc: { count: 1 } },
        { new: true }
      );
    }
    throw err;
  });

  if (!doc) {
    // findOneAndUpdate returned null → no document matched the $lt filter
    // → user is at or over their daily limit.
    const existing = await PostDailyQuota.findOne({ userId, date: today });
    return { allowed: false, limit, used: existing?.count ?? limit };
  }

  return { allowed: true, limit, used: doc.count };
}

/**
 * Releases one previously reserved post slot.
 *
 * Call this whenever a slot was reserved by canPostToday (allowed=true) but
 * the post was NOT ultimately created — e.g. duplicate detected, Post.create
 * threw, or any other failure path after the quota was incremented.
 *
 * Uses $max to prevent the counter going below 0 in edge cases.
 */
export async function releasePostSlot(userId) {
  const today = todayUTCString();
  await PostDailyQuota.updateOne(
    { userId, date: today, count: { $gt: 0 } },
    { $inc: { count: -1 } }
  );
}