# Personal Health Data Platform

Full-stack mobile app for food logging, macro tracking, and body metrics. Built as a portfolio project.

---

## Overview

No meal structure. Log food as you eat it — timestamped, unstructured. Daily macro totals accumulate against personal targets. All data is stored raw and exportable for external analysis.

| Pillar | Data |
|---|---|
| Nutrition | Food logs, macros (kcal / protein / carbs / fat), daily totals vs targets |
| Body Metrics | Weight, height, BMI, body fat %, circumference measurements |
| Activity *(Phase 2)* | Steps, calories burned, active minutes — Galaxy Watch |
| Biometrics *(Phase 2)* | Heart rate, sleep, HRV — Galaxy Watch |

---

## Stack

| | |
|---|---|
| Frontend | React Native (Expo) |
| Backend | Node.js / Express |
| Database | Supabase (PostgreSQL, Auth, RLS) |
| Phase 2 | Galaxy Watch / Apple Watch via Health Connect API / HealthKit |

---

## Screens

| Screen | |
|---|---|
| Home | Macro progress bars + today's log |
| Library | Food tiles with search + filter, one-tap to log |
| Add Food | Per-100g macros + optional unit setup |
| Scan Label | Photo-based macro parsing *(coming soon)* |
| Dashboard | Trends and analytics *(coming soon)* |
| History | Day-by-day log review *(coming soon)* |
| Settings | Targets and preferences |
| Watch | Galaxy Watch placeholder *(Phase 2)* |

---

## Setup

You'll need your own [Supabase](https://supabase.com) project.

**1. Clone and install**
```bash
git clone https://github.com/IdoGold7/Health-Tracker-Analysis.git
cd Health-Tracker-Analysis
npm install
cp .env.example .env   # fill in your Supabase URL and anon key
```

**2. Run migrations**
```bash
# Apply schema to your Supabase project
npx supabase db push
```

**3. Seed public food data** *(public instance only)*
```bash
node server/scripts/seed-public-foods.js
# Idempotent — safe to re-run. Personal instance: skip this step.
```

**4. Start the servers**
```bash
# Terminal 1 — Express server
cd server && npm run dev

# Terminal 2 — Expo client
cd client && npx expo start
```

Both instances (personal and public) use the same codebase. Switch between them by pointing `.env` at a different Supabase project URL.

---

## Project Structure

```
Health-Tracker-Analysis/
├── CLAUDE.md                  ← Claude Code entry point
├── README.md
├── .env.example               ← copy to .env, add your Supabase credentials
├── docs/
│   ├── architecture.md
│   ├── data-model.md
│   ├── ui-principles.md
│   ├── workflow.md
│   ├── quality.md
│   ├── export.md
│   └── current-task.md        ← rewritten each session
├── client/                    ← React Native (Expo)
│   ├── app/                   ← screens via Expo Router
│   ├── components/
│   ├── hooks/
│   ├── lib/                   ← API client, helpers
│   └── constants/
└── server/                    ← Node.js / Express
    ├── routes/
    ├── middleware/
    └── index.ts
```

## Environment Variables

```env
SUPABASE_URL=         # your Supabase project URL
SUPABASE_ANON_KEY=    # your Supabase anon key
PORT=3000             # Express server port
```

Two Supabase instances are supported via `.env`: a personal instance (your own food data only) and a public instance (seeded from Open Food Facts). The codebase is identical — only the env vars differ.

---

## Roadmap

- [x] Data model design
- [x] UI/UX screen design
- [ ] Supabase schema + auth
- [ ] Food library CRUD
- [ ] Food logging
- [ ] Daily macro totals
- [ ] Body metrics logging
- [ ] Scan label (Claude API)
- [ ] Dashboard + analytics
- [ ] Data export
- [ ] Galaxy Watch integration (Phase 2)

---

[Ido Goldberg](https://github.com/IdoGold7)
