// Services/username.js
import User from '../Model/User.js';

export async function ensureUsername(user) {
  if (user.username) return user;

  const base = user.email.split('@')[0].toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 20) || 'user';

  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = attempt === 0 ? base : `${base}${Math.floor(1000 + Math.random() * 9000)}`;

    try {
      const result = await User.updateOne(
        { _id: user._id, username: null },
        { $set: { username: candidate } }
      );

      if (result.modifiedCount === 0) {
        const fresh = await User.findById(user._id).select('username');
        user.username = fresh?.username;
      } else {
        user.username = candidate;
      }

      user.unmarkModified('username');
      return user;
    } catch (err) {
      if (err.code !== 11000) throw err;
    }
  }

  throw new Error('Could not allocate a username');
}