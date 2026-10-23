import 'dotenv/config';
import { sendMail } from '../Services/mailer.js';

const to = process.argv[2];
if (!to) {
  console.error('Usage: node scripts/testMail.js your-email@example.com');
  process.exit(1);
}

const result = await sendMail({
  to,
  subject: 'InternArea mail test',
  text: 'If you can read this, email sending works.',
  html: '<p>If you can read this, email sending works.</p>',
});
console.log('Result:', result);
