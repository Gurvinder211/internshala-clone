function normalizePhone(value) {
  return String(value || '').replace(/[\s()-]/g, '');
}

async function sendSms({ to, text }) {
  const demoEnabled = process.env.SMS_DEMO_ENABLED === 'true';
  const demoPhone = normalizePhone(process.env.SMS_DEMO_PHONE);

  // A deliberately narrow fallback for portfolio/demo deployments where an
  // SMS provider is unavailable. It never sends a real message and can only
  // be used for the one phone number configured in the environment.
  if (demoEnabled) {
    if (!demoPhone) {
      throw new Error('SMS_DEMO_PHONE must be configured when SMS demo mode is enabled');
    }
    if (normalizePhone(to) !== demoPhone) {
      throw new Error('SMS demo mode is limited to the configured test phone number');
    }
    console.log(`\n[SMS DEMO ONLY - NOT SENT] to: ${to}\n${text}\n`);
    return { deliveryMode: 'console' };
  }

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
