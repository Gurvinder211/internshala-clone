import { connect } from '../db.js';
import User from '../Model/User.js';
import { ensureUsername } from '../Services/username.js';

await connect();
const users = await User.find({ username: null });
for (const user of users) await ensureUsername(user);
console.log(`Backfilled ${users.length} users`);
process.exit(0);
