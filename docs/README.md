# Personal Health Data Platform

Personal health data — collected, modeled, and analyzed end to end.

---

## What This Is

A data pipeline with a UI. I built a mobile app to generate a dataset I
own completely — food logs, macro totals, body metrics — then analyze it
with SQL and Python.

The app is the collection layer. The analysis is the point.

---

## What It Tracks

| Pillar | Data |
|---|---|
| Nutrition | Food logs, macros (kcal / protein / carbs / fat), daily totals vs targets |
| Body Metrics | Weight, height, BMI, body fat %, circumference measurements |
| Activity *(Phase 2)* | Steps, calories burned, active minutes — Galaxy Watch |
| Biometrics *(Phase 2)* | Heart rate, sleep, HRV — Galaxy Watch |

---

## Data Design Decisions

- **No stored aggregates.** Daily macro totals are computed on read from raw
  log entries. The log is the source of truth.
- **Timestamp-only logging, no meal structure.** Food entries carry a timestamp
  and nothing else. No breakfast, lunch, or dinner categories — just a raw
  stream of events across the day. This keeps the dataset unstructured and
  unbiased, letting the analysis layer define any groupings.
- **Append-only body metrics.** No UPDATE or DELETE — every check-in is
  permanent history. This is what enables trend analysis.
- **Per-100g base unit.** All food macros stored per 100g. Clean, consistent,
  no unit confusion in the data.
- **Raw export.** Data exports as unaggregated logs. Aggregation happens
  in SQL and Python — not inside the app.

---

## Stack

| Layer | Technology |
|---|---|
| Mobile app | React Native (Expo) |
| Database | Supabase (PostgreSQL, Auth, Row-Level Security) |
| Analysis | DuckDB, SQL, Python *(planned)* |
| Phase 2 | Galaxy Watch / Apple Watch *(planned)* |

---

## Setup

You'll need your own [Supabase](https://supabase.com) project.

**1. Clone and install**
```bash
git clone https://github.com/IdoGold7/Health-Tracker-Analysis.git
cd Health-Tracker-Analysis/client
npm install
cp .env.example .env   # fill in your Supabase URL and anon key
```

**2. Run migrations**
```bash
npx supabase db push
```

**3. Start the app**
```bash
npx expo start
```

---

## Roadmap

- [x] Data model design
- [ ] UI/UX screen design
- [x] Supabase schema
- [x] Auth + profile auto-creation
- [x] Food library CRUD
- [x] Food logging
- [x] Daily macro totals
- [ ] Body metrics logging
- [ ] Scan label (Claude API)
- [ ] Dashboard + analytics
- [ ] Data export + analysis layer
- [ ] Galaxy Watch integration (Phase 2)

---

[Ido Goldberg](https://github.com/IdoGold7)
