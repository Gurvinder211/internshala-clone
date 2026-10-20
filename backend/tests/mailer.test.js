import assert from 'node:assert/strict';
import test from 'node:test';
import { sendMail } from '../Services/mailer.js';

const originalFetch = globalThis.fetch;
const originalEnv = {
  RESEND_API_KEY: process.env.RESEND_API_KEY,
  EMAIL_FROM: process.env.EMAIL_FROM,
  SMTP_FROM: process.env.SMTP_FROM,
  SMTP_HOST: process.env.SMTP_HOST,
};

test('sendMail uses Resend over HTTPS when configured', async () => {
  process.env.RESEND_API_KEY = 'test-api-key';
  process.env.EMAIL_FROM = 'InternArea <verified@example.com>';
  delete process.env.SMTP_HOST;

  let request;
  globalThis.fetch = async (url, options) => {
    request = { url, options };
    return new Response(null, { status: 200 });
  };

  try {
    const result = await sendMail({
      to: 'user@example.com',
      subject: 'Verify sign-in',
      html: '<p>Code</p>',
      text: 'Code',
    });

    assert.deepEqual(result, { deliveryMode: 'email' });
    assert.equal(request.url, 'https://api.resend.com/emails');
    assert.equal(request.options.headers.Authorization, 'Bearer test-api-key');
    assert.deepEqual(JSON.parse(request.options.body), {
      from: 'InternArea <verified@example.com>',
      to: ['user@example.com'],
      subject: 'Verify sign-in',
      html: '<p>Code</p>',
      text: 'Code',
    });
  } finally {
    globalThis.fetch = originalFetch;
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
