async function sendSms({ to, text }) {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM;
  if (!sid || !token || !from) {
    if (process.env.NODE_ENV === 'production') throw new Error('Twilio credentials are required to send SMS in production');
    console.log(`\n[DEV SMS ONLY - NOT SENT] to: ${to}\n${text}\n`);
    return { deliveryMode: 'console' };
  }

  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ To: to, From: from, Body: text }),
  });
  if (!response.ok) throw new Error(`SMS provider rejected the message (${response.status})`);
  return { deliveryMode: 'sms' };
}

export { sendSms };