# InternArea — Internship & Job Portal

A full-stack, Internshala-style platform where students browse and apply for internships and jobs. This fork extends the open-source [BitHeadmr/internshala-clone](https://github.com/BitHeadmr/internshala-clone) with six security- and business-focused features: a multilingual interface with OTP-gated language changes, a paid Resume Builder, password recovery by email or SMS, a social **Public Space**, device-aware login security, and Razorpay-powered subscriptions.

**Live demo:** https://internshala-clone-wheat.vercel.app
**API:** https://internshala-backend-69sb.onrender.com

> The API runs on Render's free tier, so the first request after a period of inactivity can take about a minute while the server wakes up.

## Contents

- [Features](#features)
- [Tech stack](#tech-stack)
- [Project structure](#project-structure)
- [Getting started](#getting-started)
- [Environment variables](#environment-variables)
- [Key rules and where they live](#key-rules-and-where-they-live)
- [API overview](#api-overview)
- [Deployment](#deployment)
- [Security notes](#security-notes)
- [Known limitations](#known-limitations)
- [Credits](#credits)

## Features

The original app lets students browse internships and jobs and apply, and lets an admin post listings and review applications. The features below were added on top.

### 1. Multi-language support
- Six languages: English, Spanish, Hindi, Portuguese, Chinese and French (`next-i18next`).
- Switch at any time from the navbar without a page reload; the current page and session are preserved.
- The choice is saved on the user's profile and in the browser, so it follows the user across devices.
- Switching to **French requires an email OTP** and is applied only after verification.
- Every change is logged with the language, timestamp, IP address, browser and device.

### 2. Resume Builder (paid)
- Available to users on any paid plan. Covers personal details, career objective, education, experience, internships, projects, certifications, achievements, skills, languages, social links and references.
- Three ATS-friendly, single-column templates, with theme colour and font choices, a live preview, and multiple saved versions.
- **₹50 per generated resume.** Flow: email OTP → Razorpay payment (signature verified on the server) → PDF generated on the server with `@react-pdf/renderer`. The PDF cannot be produced without both steps.
- A newly generated resume becomes the default and is attached to internship applications; the default can be changed at any time.
- Payment, invoice and download history are kept. Editing a resume after paying keeps the purchased PDF downloadable, marked "edited since PDF"; generating an updated PDF costs ₹50 again.

### 3. Forgot password
- Reset by registered **email or mobile number** at `/forgot-password`.
- Allowed **once every 24 hours** — otherwise: "You can use this option only once per day."
- OTP verification with expiry, resend cooldown and attempt limits.
- A random, letters-only temporary password is generated, stored hashed (bcrypt) and delivered only through the verified channel (email or SMS). The user must change it after the next login (`/change-password`).
- Every reset is logged: request time, method, verification status, IP, browser and device.

### 4. Public Space
- Posts with text, photos or video; likes, comments, shares, saves and reports; follow users and send friend requests; `@mentions` and `#hashtags`; notifications for likes, comments, shares, friend requests and mentions.
- Posting allowance depends on accepted friends: **0 friends → cannot post · 1 → 1 post/day · 2–5 → 2/day · 6–10 → 5/day · more than 10 → unlimited.** The friend count at posting time is stored with each post.
- Posts can be edited or deleted within 15 minutes. Duplicate posts, spam and excessive posting are limited with duplicate detection and rate limiting; a post is hidden automatically after 5 reports.
- Personalised feed: friends' posts first, then trending, then recent public posts.

### 5. Login security and sessions
- A **Login History** section on the profile page records browser and version, operating system, device type and model, IP address, approximate location, status and time.
- **Google Chrome sign-ins always require an email OTP.** Other browsers require an OTP the first time on a device, which is then marked trusted.
- **Mobile sign-ins are allowed only between 10:00 AM and 1:00 PM IST**; attempts outside that window are rejected with a message.
- Server-side sessions (up to 5 active), an active-sessions list, and "sign out other devices". New browsers, devices and IPs are flagged in the history.
- Handles expired OTPs, repeated failures (lockout), duplicate login requests, simultaneous logins and dropped connections during verification.

### 6. Subscriptions
| Plan | Price | Internship applications |
|---|---|---|
| Free | ₹0 | 1 per month |
| Bronze | ₹100 / month | up to 3 |
| Silver | ₹300 / month | up to 5 |
| Gold | ₹1000 / month | unlimited |

- Compare, purchase, upgrade and renew plans with Razorpay (test mode). Downgrade and cancel take effect when the current period ends.
- **Payments can only be started between 5:00 AM and 11:45 AM IST.**
- Payment signatures are verified server-side; the plan is activated, the quota updated, and a confirmation email with the invoice, transaction ID, amount, plan, validity and billing details is sent.
- The profile shows the current plan, remaining quota, renewal date and previous invoices.
- Applying is blocked once the quota is used up, until it resets or the plan is upgraded. Quota consumption is atomic, and duplicate or interrupted payments are handled safely.

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 15 (pages router), React 19, TypeScript, Tailwind CSS 4, Redux Toolkit, `next-i18next`, Axios |
| Backend | Node.js, Express 4, Mongoose 8 (ES modules, run with `tsx`) |
| Database | MongoDB |
| Authentication | Firebase Authentication (Google sign-in) and email + password (JWT), both gated by server-side sessions |
| Payments | Razorpay (test mode) |
| Email / SMS | Gmail via Google Apps Script relay (default), Resend or SMTP as alternatives; Twilio for SMS |
| PDF | `@react-pdf/renderer` |
| Other | `ua-parser-js` and `geoip-lite` (device and location), `multer` (uploads), `express-rate-limit`, `bcrypt` |
| Hosting | Vercel (frontend), Render (backend), MongoDB Atlas |

## Project structure

```
.
├── backend/                  Express API
│   ├── Model/                Mongoose models (User, Session, LoginHistory, Post, Resume, Transaction, ...)
│   ├── Routes/               Route modules, mounted under /api
│   ├── Services/             Business logic (OTP, sessions, plans, mailer, SMS, PDF, ...)
│   ├── middleware/           auth (token + session) and upload handling
│   ├── scripts/              seedSampleListings.js, backfillUsernames.js
│   ├── tests/                Unit tests (node:test)
│   └── index.js
├── internarea/               Next.js frontend
│   ├── public/locales/       Translations: en, es, hi, pt, zh, fr
│   └── src/                  Components, Feature (Redux), firebase, lib, pages
└── render.yaml               Render blueprint for the backend
```

## Getting started

**Prerequisites:** Node.js 20 or newer, a MongoDB database (local or Atlas), a Firebase project with Google sign-in enabled, and Razorpay test keys if you want to try payments.

### 1. Clone

```bash
git clone https://github.com/Gurvinder211/internshala-clone.git
cd internshala-clone
```

### 2. Backend

```bash
cd backend
npm install
cp .env.example .env          # then fill in the values (see below)
```

Download a service-account key from **Firebase Console → Project settings → Service accounts** and save it as `backend/serviceAccountKey.json` (it is gitignored). Then:

```bash
npm run dev                   # API on http://localhost:5000
```

### 3. Frontend

```bash
cd internarea
npm install
cp .env.example .env
```

Set `NEXT_PUBLIC_FIREBASE_API_KEY` to your Firebase web API key and point the app at your local API:

```
NEXT_PUBLIC_API_URL=http://localhost:5000/api
```

> If `NEXT_PUBLIC_API_URL` is left unset, the app talks to the hosted API.

The Firebase project identifiers in `internarea/src/firebase/firebase.js` belong to this project's Firebase app; replace them if you use your own project.

```bash
npm run dev                   # http://localhost:3000
```

### 4. Optional

```bash
cd backend
npm run seed:samples          # adds clearly marked demo internships and jobs
npm test                      # unit tests: mailer, password generation, IST windows, posting tiers, resume payload sanitising
```

### Development behaviour

- With no email provider configured and `NODE_ENV` not set to `production`, OTP emails are **printed in the backend terminal** (`[DEV MAIL ONLY - NOT SENT]`) instead of being sent. SMS works the same way without Twilio credentials.
- The payment and mobile-login time windows can be bypassed for local testing with `PAYMENT_WINDOW_BYPASS=true` and `MOBILE_WINDOW_BYPASS=true`. **Never enable these in production.**
- Razorpay test card: `4111 1111 1111 1111` with any future expiry and any CVV.
- On localhost the login history shows the location as "Local network"; real cities appear once deployed.

## Environment variables

### Backend (`backend/.env`)

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | yes | MongoDB connection string |
| `JWT_SECRET` | yes | Secret used to sign email-login tokens |
| `CORS_ORIGIN` | in production | Comma-separated browser origins allowed to call the API (default `http://localhost:3000`) |
| `FIREBASE_SERVICE_ACCOUNT` | in production | Stringified contents of the Firebase service-account JSON. In development the local `serviceAccountKey.json` is used instead |
| `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` | for payments | Razorpay **test-mode** keys |
| `APPS_SCRIPT_MAIL_URL`, `APPS_SCRIPT_MAIL_SECRET` | email | Gmail relay (see [Email](#email-without-a-custom-domain)). Recommended on Render's free tier |
| `RESEND_API_KEY`, `EMAIL_FROM` | alternative | Resend API (needs a verified sending domain) |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | alternative | SMTP fallback (blocked on Render's free tier) |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM` | for SMS | Required in production for password reset by mobile number |
| `PAYMENT_WINDOW_BYPASS`, `MOBILE_WINDOW_BYPASS` | no | `true` disables the IST time rules. Development and demos only |
| `NODE_ENV`, `PORT` | no | `production` on hosting; `PORT` defaults to 5000 |

Mail provider order: Apps Script relay → Resend → SMTP → console (non-production only). In production, sending fails if no provider is configured.

### Frontend (`internarea/.env`)

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_API_URL` | Backend base URL **including `/api`**, e.g. `http://localhost:5000/api` |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Firebase web API key |

These values are baked in at build time, so redeploy the frontend after changing them.

## Key rules and where they live

| Rule | Defined in |
|---|---|
| Plan prices, quotas and the 30-day billing cycle | `backend/Services/plans.js` |
| Payment window, 5:00 AM – 11:45 AM IST | `backend/Services/paymentWindow.js` |
| Mobile login window 10:00 AM – 1:00 PM IST; Chrome / new-device OTP rules | `backend/Services/loginPolicy.js` |
| OTP generation, expiry, cooldown, attempt and daily limits | `backend/Services/otpService.js` |
| Sessions: creation, trusted devices, active-session cap | `backend/Services/sessionService.js` |
| Token + active-session check on every protected route | `backend/middleware/auth.js` |
| Posting limits by friend count | `backend/Services/postLimits.js` |
| Post edit window, report threshold | `backend/Routes/post.js` |
| Resume price, OTP → payment → PDF flow | `backend/Routes/resume.js` |
| Password reset rules (once per 24 hours) | `backend/Routes/passwordReset.js` |

## API overview

All routes are mounted under `/api`.

| Prefix | Purpose |
|---|---|
| `/auth` | Register, login, change password, `me`; session start, OTP verify/resend, active sessions, logout, login history |
| `/user` | Profile sync, mobile number |
| `/language` | Language preference and the French OTP flow |
| `/password-reset` | Request and verify a password reset (email or SMS) |
| `/subscription` | Plans, current subscription and invoices, order, verify, reconcile, downgrade, cancel |
| `/resume` | Resume versions, OTP, payment, PDF download, history, default resume |
| `/post`, `/feed` | Create, edit, delete and engage with posts; personalised feed |
| `/social` | Friend requests, friends list, user search, follow |
| `/notification` | List and mark notifications |
| `/internship`, `/job`, `/application`, `/admin` | Original listing and application features |

Protected routes need two headers: `Authorization: Bearer <token>` (Firebase ID token or the app's own JWT) and `X-Session-Id` for an active session. The frontend adds both automatically.

## Deployment

The app is deployed as **Vercel** (frontend) + **Render** (backend) + **MongoDB Atlas** (database).

1. **MongoDB Atlas** — create a free cluster and a database user, allow network access (`0.0.0.0/0` on Render's free tier), and copy the connection string.
2. **Backend on Render** — create a Web Service from this repository (a Blueprint can use `render.yaml`): root directory `backend`, build command `npm ci`, start command `npm start`, health check path `/`. Set the backend environment variables above, including `NODE_ENV=production`, `FIREBASE_SERVICE_ACCOUNT` and `CORS_ORIGIN` (your exact Vercel URL, no trailing slash).
3. **Frontend on Vercel** — import the repository with root directory `internarea` and set `NEXT_PUBLIC_API_URL` (your Render URL plus `/api`) and `NEXT_PUBLIC_FIREBASE_API_KEY`.
4. **Firebase** — under **Authentication → Settings → Authorized domains**, add your Vercel domain, or Google sign-in fails with `auth/unauthorized-domain`.
5. **Payments** — use Razorpay test keys. No webhook is needed.

### Email without a custom domain

Render's free tier blocks outbound SMTP, and several email APIs require a verified domain. The app can instead send through a regular Gmail account using a small Google Apps Script web app over HTTPS (limit: about 100 emails per day for a standard Gmail account).

1. At [script.google.com](https://script.google.com), create a project and paste the script below, replacing the secret.
2. **Deploy → New deployment → Web app**, with *Execute as: Me* and *Who has access: Anyone*. Approve the permission prompt and copy the `/exec` URL.
3. Set `APPS_SCRIPT_MAIL_URL` to that URL and `APPS_SCRIPT_MAIL_SECRET` to the same secret on the backend.

After editing the script, publish a **new version** (Deploy → Manage deployments) or the old code keeps running. Treat the secret like a password.

<details>
<summary>Apps Script relay</summary>

```js
const SECRET = 'replace-with-a-long-random-string';

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    if (body.secret !== SECRET) return reply({ ok: false, error: 'unauthorized' });
    if (!body.to || !body.subject) return reply({ ok: false, error: 'bad request' });

    MailApp.sendEmail({
      to: body.to,
      subject: body.subject,
      body: body.text || '',
      htmlBody: body.html || undefined,
      name: body.name || 'InternArea',
    });
    return reply({ ok: true, remaining: MailApp.getRemainingDailyQuota() });
  } catch (err) {
    return reply({ ok: false, error: String(err) });
  }
}

function doGet() {
  return reply({ ok: true, service: 'mail relay' });
}

function reply(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
```

Test it with `curl -L -H "Content-Type: application/json" -d '{"secret":"...","to":"you@gmail.com","subject":"test","text":"hello"}' "<your /exec URL>"` (do not add `-X POST`; it breaks the redirect).

</details>

## Security notes

- Passwords and OTPs are stored hashed (bcrypt for passwords, SHA-256 for OTPs); one-time codes are generated with `crypto`.
- Every protected request needs a valid token **and** an active server-side session, so OTP gates and "sign out other devices" are enforced on the server.
- Razorpay payment signatures are verified with HMAC-SHA256 using a timing-safe comparison; payment finalisation is idempotent, so a payment can never activate twice.
- Application quota is consumed with a single atomic database update, so simultaneous requests cannot exceed the limit.
- Resume create/update only accepts whitelisted fields, and downloads are served only through an authenticated route for the owner.
- Client IP comes from `req.ip` (with `trust proxy` in production), not from a forgeable header. OTP and payment routes are rate limited.
- Account-recovery endpoints return the same response whether or not an account exists.

## Known limitations

- **The admin area is not secured.** The admin login uses hard-coded credentials and returns no token, and the endpoints for posting listings and for viewing and accepting applications are not protected (inherited from the original project). Add real admin authentication before any production use.
- **Local disk storage.** Post media and generated resume PDFs are written to `backend/storage/`, which is wiped when a free hosting instance restarts. Use cloud storage (for example Cloudinary or S3) for anything persistent. Media URLs of friends-only posts are not access-controlled.
- **Device detection is based on the `User-Agent` header**, which a client can change. Desktop and laptop cannot be told apart, and Brave identifies itself as Chrome.
- **Payments run in Razorpay test mode** with no webhooks; interrupted payments are settled through a reconcile endpoint. Plans are 30-day passes with no automatic renewal.
- **Email and SMS limits.** The Gmail relay allows about 100 emails a day. SMS needs a Twilio account (trial accounts can only text verified numbers); without one, SMS is printed to the server console in development.
- **Resume templates.** *Modern* and *Minimal* currently share the *Classic* single-column layout (Minimal uses a neutral dark accent).
- **Moderation.** Content moderation is limited to hiding posts after repeated reports. Emails and server-side validation messages are English only.

## Credits

Based on [BitHeadmr/internshala-clone](https://github.com/BitHeadmr/internshala-clone). Built with Next.js, Express, MongoDB, Firebase, Razorpay and the open-source libraries listed in the two `package.json` files.
