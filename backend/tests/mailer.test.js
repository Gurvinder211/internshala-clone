import assert from 'node:assert/strict';
import test from 'node:test';
import { sendMail } from '../Services/mailer.js';

const originalFetch = globalThis.fetch;
const originalEnv = {
  APPS_SCRIPT_MAIL_URL: process.env.APPS_SCRIPT_MAIL_URL,
  APPS_SCRIPT_MAIL_SECRET: process.env.APPS_SCRIPT_MAIL_SECRET,
  EMAIL_FROM_NAME: process.env.EMAIL_FROM_NAME,
  SENDGRID_API_KEY: process.env.SENDGRID_API_KEY,
  RESEND_API_KEY: process.env.RESEND_API_KEY,
  EMAIL_FROM: process.env.EMAIL_FROM,
  SMTP_FROM: process.env.SMTP_FROM,
  SMTP_HOST: process.env.SMTP_HOST,
  SMTP_PORT: process.env.SMTP_PORT,
};

test('sendMail uses Apps Script relay before other configured providers', async () => {
  process.env.APPS_SCRIPT_MAIL_URL = 'https://script.example.com/exec';
  process.env.APPS_SCRIPT_MAIL_SECRET = 'test-secret';
  process.env.EMAIL_FROM_NAME = 'Test Sender';
  process.env.RESEND_API_KEY = 'test-resend-key';
  delete process.env.SENDGRID_API_KEY;
  delete process.env.SMTP_HOST;

  let request;
  globalThis.fetch = async (url, options) => {
    request = { url, options };
    return Response.json({ ok: true, remaining: 20 });
  };

  try {
    const result = await sendMail({
      to: 'user@example.com',
      subject: 'Verify sign-in',
      html: '<p>Code</p>',
      text: 'Code',
    });

    assert.deepEqual(result, { deliveryMode: 'email' });
    assert.equal(request.url, 'https://script.example.com/exec');
    assert.deepEqual(JSON.parse(request.options.body), {
      secret: 'test-secret',
      to: 'user@example.com',
      subject: 'Verify sign-in',
      html: '<p>Code</p>',
      text: 'Code',
      name: 'Test Sender',
    });
  } finally {
    globalThis.fetch = originalFetch;
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test('sendMail rejects Apps Script configuration without a secret', async () => {
  process.env.APPS_SCRIPT_MAIL_URL = 'https://script.example.com/exec';
  delete process.env.APPS_SCRIPT_MAIL_SECRET;
  delete process.env.SENDGRID_API_KEY;
  delete process.env.RESEND_API_KEY;
  delete process.env.SMTP_HOST;

  try {
    await assert.rejects(
      sendMail({
        to: 'user@example.com',
        subject: 'Verify sign-in',
        html: '<p>Code</p>',
        text: 'Code',
      }),
      { code: 'EMAIL_NOT_CONFIGURED' }
    );
  } finally {
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test('sendMail uses Resend over HTTPS when configured', async () => {
  delete process.env.APPS_SCRIPT_MAIL_URL;
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
  delete process.env.APPS_SCRIPT_MAIL_URL;
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

test('sendMail uses SMTP when no API provider is configured', async () => {
  delete process.env.APPS_SCRIPT_MAIL_URL;
  process.env.SMTP_HOST = '127.0.0.1';
  process.env.SMTP_PORT = '1';
  delete process.env.SENDGRID_API_KEY;
  delete process.env.RESEND_API_KEY;

  let apiCalled = false;
  globalThis.fetch = async () => {
    apiCalled = true;
    return new Response(null, { status: 202 });
  };

  try {
    await assert.rejects(
      sendMail({
        to: 'user@example.com',
        subject: 'Verify sign-in',
        html: '<p>Code</p>',
        text: 'Code',
      })
    );
    assert.equal(apiCalled, false);
  } finally {
    globalThis.fetch = originalFetch;
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
