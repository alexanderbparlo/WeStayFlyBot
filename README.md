# WeStayFlyBot 🛫

> Deal alerts for the restless. Get emailed when flights and hotels drop 35%+ below typical pricing.

## Stack

| Layer | Tool | Cost |
|---|---|---|
| Frontend + API | Next.js 14 on Vercel | Free |
| Database | Vercel Postgres (Neon) | Free tier |
| Flight pricing | SerpApi — Google Flights engine | Free (250 searches/mo) |
| Hotel pricing | Xotelo API | Free (no key needed) |
| Email | Resend | Free (3,000 emails/mo) |
| Cron scheduling | Vercel Cron | Free (2 jobs) |

---

## Setup & Deployment

### 1. Clone and install

```bash
git clone <your-repo>
cd westayflybot
npm install
```

### 2. Create Vercel project

```bash
npm i -g vercel
vercel
```

### 3. Attach Vercel Postgres

In the Vercel dashboard: **Storage → Create → Postgres**. Vercel auto-injects all `POSTGRES_*` env vars.

Pull them locally:
```bash
vercel env pull .env.local
```

### 4. Run database migration

```bash
npm run db:migrate
```

Or paste the contents of `lib/schema.sql` directly into the Vercel Postgres query console.

### 5. Get your API keys

**SerpApi** (flight prices):
- Sign up at https://serpapi.com
- Free tier: 250 searches/month — sufficient for a small group scanning 2x daily
- Copy your API key to `SERPAPI_API_KEY`

**Resend** (email):
- Sign up at https://resend.com
- Add and verify your sending domain (e.g. `alerts@westayflybot.com`)
- Copy your API key to `RESEND_API_KEY`
- Update `FROM_EMAIL` in `lib/email.ts` if your domain differs

**Xotelo** (hotels):
- No API key required — completely free

### 6. Set environment variables

Copy `.env.example` to `.env.local` and fill in:

```
SERPAPI_API_KEY=your_key_here
RESEND_API_KEY=your_key_here
CRON_SECRET=$(openssl rand -hex 32)
NEXT_PUBLIC_SITE_URL=https://westayflybot.vercel.app
```

Add all of these to **Vercel → Settings → Environment Variables**.

### 7. Deploy

```bash
vercel --prod
```

### 8. Replace the landing page

Copy your `index.html` landing page into `public/index.html` (or convert it to `app/page.tsx`).
Update the subscribe button's `fetch` call to point to `/api/subscribe`.

---

## Cron Schedule

Defined in `vercel.json`:

| Time (UTC) | Local (ET) | Purpose |
|---|---|---|
| 13:00 UTC | 8:00 AM ET | Morning scan (catches overnight airline sales) |
| 01:00 UTC | 8:00 PM ET | Evening scan (catches same-day price drops) |

Vercel Cron calls `GET /api/cron/scan-deals` with `Authorization: Bearer <CRON_SECRET>`.

---

## Deal Logic Reference

| Condition | Alert Type |
|---|---|
| Flight ≥35% below typical | ✈️ Flight Deal |
| Flight ≥35% + Hotel ≥35% (same dates) | ⭐ Special Bundle Deal |
| Flight ≥15% + Hotel ≥35% (same dates) | ✈️🏨 Flight + Hotel Combo |
| Hotel ≥35%, flight <20% off | ❌ No alert |
| Road trip hotel ≥35% | 🚗🏨 Road Trip Hotel Deal |

Deduplication: same deal is suppressed for 72 hours after first alert.

---

## Project Structure

```
westayflybot/
├── app/
│   └── api/
│       ├── subscribe/route.ts          # POST — new subscription
│       ├── unsubscribe/route.ts        # GET  — one-click unsubscribe
│       ├── update-preferences/route.ts # POST — update preferences
│       └── cron/
│           └── scan-deals/route.ts     # GET  — main deal scanner (cron)
├── lib/
│   ├── db.ts                           # Vercel Postgres client + all queries
│   ├── schema.sql                      # Database schema (run once)
│   ├── flight-scanner.ts               # SerpApi integration + flight deal logic
│   ├── hotel-scanner.ts                # Xotelo integration + hotel deal logic
│   ├── deal-evaluator.ts               # Rule table + dedup + email dispatch
│   └── email.ts                        # Resend templates (welcome + deal alerts)
├── public/
│   └── index.html                      # Landing page (from design step)
├── vercel.json                         # Cron schedule
├── package.json
└── .env.example                        # Environment variable template
```

---

## Scaling Notes

- **SerpApi limit hit?** Upgrade to $50/mo plan (5,000 searches) or reduce `SCAN_INTERVAL_DAYS` scan density.
- **Adding more users?** The architecture already supports multi-user — the schema and cron loop are subscriber-driven. Just remove the invite gate from the landing page.
- **Xotelo reliability?** If Xotelo is down, hotel scans return empty gracefully. Consider adding Makcorps as a fallback hotel API (free tier available).
