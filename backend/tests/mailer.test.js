import assert from 'node:assert/strict';
import test from 'node:test';
import { sendMail } from '../Services/mailer.js';

const originalFetch = globalThis.fetch;
const originalEnv = {
  SENDGRID_API_KEY: process.env.SENDGRID_API_KEY,
  RESEND_API_KEY: process.env.RESEND_API_KEY,
  EMAIL_FROM: process.env.EMAIL_FROM,
  SMTP_FROM: process.env.SMTP_FROM,
  SMTP_HOST: process.env.SMTP_HOST,
};

test('sendMail uses Resend over HTTPS when configured', async () => {
  delete process.env.SENDGRID_API_KEY;
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

test('sendMail uses SendGrid with a verified single sender over HTTPS', async () => {
  process.env.SENDGRID_API_KEY = 'test-sendgrid-key';
  delete process.env.RESEND_API_KEY;
  process.env.EMAIL_FROM = 'InternArea <sender@gmail.com>';
  delete process.env.SMTP_HOST;

  let request;
  globalThis.fetch = async (url, options) => {
    request = { url, options };
    return new Response(null, { status: 202 });
  };

  try {
    const result = await sendMail({
      to: 'user@example.com',
      subject: 'Verify sign-in',
      html: '<p>Code</p>',
      text: 'Code',
    });

    assert.deepEqual(result, { deliveryMode: 'email' });
    assert.equal(request.url, 'https://api.sendgrid.com/v3/mail/send');
    assert.equal(request.options.headers.Authorization, 'Bearer test-sendgrid-key');
    assert.deepEqual(JSON.parse(request.options.body), {
      personalizations: [{ to: [{ email: 'user@example.com' }] }],
      from: { email: 'sender@gmail.com', name: 'InternArea' },
      subject: 'Verify sign-in',
      content: [
        { type: 'text/plain', value: 'Code' },
        { type: 'text/html', value: '<p>Code</p>' },
      ],
    });
  } finally {
    globalThis.fetch = originalFetch;
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
