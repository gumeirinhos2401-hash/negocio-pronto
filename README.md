# Negócio Pronto

Web app for small businesses in Portugal (cafés, hair salons, barbers, beauty professionals, shops) to write social media posts, plan a monthly content calendar, answer customers with ready-made replies and send quotes in euros. The interface is in European Portuguese.

This is an MVP built for validation. It does not publish to social networks and takes no payments: the Pro plan checkout is a labelled simulation.

> Built by Gustavo Meirinhos Silva with the assistance of an AI coding assistant (Claude Code).

## What it does

- **Posts** for Instagram, Facebook and Google Business Profile: title, caption, call to action and hashtags, generated from fixed sentence templates and the business profile. The generator never adds prices, promotions, reviews or results the user did not type (enforced by tests).
- **Content calendar** with monthly suggestions and three states: planned, published (a manual record), cancelled.
- **Quick replies** for prices, hours, location, bookings, delays, cancellations and complaints.
- **Quotes** with a live preview, copy as text and PDF download.
- **Plans**: free (5 saved posts per month) and Pro (€9,90/month, 7-day trial, simulated).

## Architecture

```
src/          React + TypeScript app (Vite), plain CSS with design tokens
  domain/     pure logic shared with the API: text generators, plan limits, money, validation
  storage/    DataProvider: loads the account once, sends each change to the API
server/       Fastify API (TypeScript)
  src/app.ts  routes, sessions, rate limits
  src/db.ts   Postgres (pg) in production, embedded PGlite in development and tests
e2e/          Playwright journeys with axe accessibility checks
```

Security choices worth knowing:

- Passwords hashed with scrypt; session, email-confirmation and reset tokens stored only as SHA-256 hashes.
- Session cookie `httpOnly`, `SameSite=Strict`, `Secure` in production; writes from other origins are refused.
- Every table is scoped by `user_id`; tests check that one account cannot read or change another's data.
- Rate limits kept in the database: per address, per account (failed logins only) and per account for writes.
- Monthly post usage taken atomically with the insert, so parallel requests cannot pass the limit.
- Strict Content-Security-Policy on the built page; no third-party requests at runtime.

## Run locally

Requires Node.js 24.

```
npm install
npm run server     # API on http://127.0.0.1:3001 (embedded Postgres in server/data, nothing else to install)
npm run dev        # app on http://localhost:5173, /api is proxied to the API
```

In development, emails are not sent: the confirmation and reset links are printed in the API terminal.

## Tests

```
npm test              # frontend tests, run against the real API on an embedded Postgres
npm run test:server   # API tests (set TEST_DATABASE_URL to run them on a Postgres server)
npm run e2e           # Playwright on the production build, desktop and phone
npm run lint && npm run typecheck && npm run typecheck:server
```

CI runs all of the above on every push, plus the API tests on Postgres 17, a dependency audit and a secret scan.

## Configuration

See [`server/.env.example`](server/.env.example). Production needs `DATABASE_URL` and `APP_URL`; email needs `RESEND_API_KEY` and `MAIL_FROM`.

## Not in this MVP

Publishing to or reading from social networks, WhatsApp, real payments, AI text generation, images, invoicing and tax calculation, multiple businesses or team members.
