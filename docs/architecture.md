# Architecture

## What This Is

A mobile-first, full-stack health tracking app. Users log food as they eat it (no meal structure), track daily macros against personal targets, and record body metrics over time. Phase 2 adds Galaxy Watch integration for passive biometric data.

Built as a portfolio project. All code is public. Food data lives in Supabase — never in the repo.

---

## Stack

| Layer | Technology | Notes |
|---|---|---|
| Frontend | React Native (Expo) | Mobile + web via Expo Go |
| Backend | Node.js / Express | REST API |
| Database | Supabase | PostgreSQL + Auth + Row-Level Security |
| Phase 2 | Galaxy Watch / Apple Watch | Health Connect API (Android) / HealthKit (iOS) |

---

## Folder Structure

```
Health-Tracker-Analysis/
├── CLAUDE.md                  ← Claude Code entry point
├── README.md
├── .env.example               ← committed, empty values only
├── docs/
│   ├── architecture.md        ← this file
│   ├── data-model.md
│   ├── ui-principles.md
│   ├── workflow.md
│   ├── quality.md
│   ├── export.md
│   └── current-task.md        ← rewritten each session
│
├── client/                    ← React Native (Expo)
│   ├── app/                   ← screens (file-based routing via Expo Router)
│   │   ├── index.tsx          ← Home
│   │   ├── library.tsx
│   │   ├── add-food.tsx
│   │   ├── scan-label.tsx
│   │   ├── dashboard.tsx
│   │   ├── history.tsx
│   │   ├── settings.tsx
│   │   └── watch.tsx
│   ├── components/            ← reusable UI components
│   ├── hooks/                 ← custom React hooks
│   ├── lib/                   ← API client, helpers
│   └── constants/             ← colors, layout values
│
├── server/                    ← Node.js / Express
│   ├── routes/                ← one file per resource (foods, logs, metrics)
│   ├── middleware/            ← auth, error handling
│   └── index.ts               ← entry point
│
└── .gitignore                 ← excludes all local food data files
```

> `current-task.md` is the only doc that changes between sessions. Everything else is stable reference.

---

## Data Flow

```
User action (mobile)
      ↓
React Native screen
      ↓
Most operations: Supabase client (direct)
      ↓
Supabase (PostgreSQL + RLS)

Specific operations (e.g. Scan Label):
React Native → Express route → Claude API / third-party → Supabase
```

Authentication is handled by Supabase Auth. RLS policies enforce that users only see their own data — at the database level. Express handles only operations that require server-side logic or API keys that must not be exposed in the client (e.g. Claude API for Scan Label).

**Service boundary rule (default):** CRUD for user-owned records goes direct from client to Supabase. Any operation involving secrets, third-party APIs, or nontrivial server-side transformation goes through Express. Exceptions are possible but require a deliberate reason — mixing patterns without one creates maintenance debt.

---

## Row-Level Security Policy Matrix

RLS is the primary security boundary. All tables have RLS enabled.

| Table | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| `profiles` | Own row only | Own row only | Own row only | — |
| `public_foods` | All authenticated users | — | — | — |
| `user_foods` | Own rows only | Own rows only | Own rows only | Own rows only |
| `food_logs` | Own rows only | Own rows only | Own rows only | Own rows only |
| `body_metrics` | Own rows only | Own rows only | Own rows only | Own rows only |

- `public_foods` is read-only for all users. Seeding uses the service role key at migration time only — never during normal app operation.
- Express routes that write to Supabase on behalf of a user pass the user's JWT, not the service role key. RLS still applies.

---

## Screens

| Screen | Purpose |
|---|---|
| Home | Macro progress bars + today's food log |
| Library | Food tiles, search + filter, one-tap to log |
| Add Food | Enter per-100g macros + optional unit preset |
| Scan Label | Photo → Claude API parses nutrition label *(coming soon)* |
| Dashboard | Macro trends, body metric charts *(coming soon)* |
| History | Day-by-day log review *(coming soon)* |
| Settings | Personal targets (kcal, protein, carbs, fat, target weight, height), preferences |
| Watch | Galaxy Watch / Apple Watch placeholder *(Phase 2)* |

---

## Key Design Decisions

**No meal structure.** Food is logged with a timestamp only. The app doesn't know about breakfast, lunch, or dinner — it just accumulates entries across the day. This keeps logging fast and removes a layer of forced structure.

**Per-100g as the base unit.** All food macros are stored per 100g. When a user logs a food, they enter grams and the app calculates the macros. Optional unit presets (e.g. "1 egg = 60g") can be saved to make common entries faster — but the underlying data is always grams-based.

**Two instances, same codebase.** The app runs against two separate Supabase projects, toggled via `.env`:
- **Personal instance** — populated with personal food data only. No public dataset noise.
- **Public instance** — seeded with open, copyright-free food data (Open Food Facts, tentative) so the app is usable out of the box. Seeding script is part of the initial build.

No proprietary food data is committed to the repo. The `.env` determines which instance the app connects to.

**Computed totals, never stored.** Daily macro totals are not stored as records. They are computed on read by summing the raw log entries for the current day. The same mechanic applies to exported data — aggregate stats are computed at download time from the same raw logs. No separate totals table. No sync logic. Raw events are the single source of truth.

**Timezone: device-local, known limitation.** The app defines "today" using the device's local time. This means day boundaries can shift if the user travels across timezones, and logs recorded offline may land on the wrong day after sync. This is a known edge case. It is an informed decision to exclude timezone normalization from the project scope — not an oversight.

**Food data ownership.** Food data is split across two tables: `public_foods` (seed data, shared read-only across all users) and `user_foods` (private, RLS-enforced per user). When a user logs a public food with a custom unit, the app copies it into `user_foods` — the user then owns and edits their copy. There is no cross-user food sharing, merging, or social layer. This is a portfolio project — the complexity of a shared food graph is explicitly out of scope.

**Scan Label.** User takes a photo of a nutrition label. The image is sent to the Claude API server-side (via Express, to keep the API key out of the client). Claude parses the macros and returns structured data. The user confirms, then the entry is logged and optionally saved to their food library. No barcode scanner. Technical spec (image storage, error handling, parse failure flow) is deferred to a later doc.

**Raw data export.** The app exports raw, unaggregated logs. Aggregation and analysis happen outside the app (personal layer — DuckDB, SQL, Python). See `export.md` for the export format spec.

---

## Phase 2: Watch Integration

Not in scope for the initial build. No technical design committed yet.

Planned data sources: Health Connect API (Galaxy Watch / Android), HealthKit (Apple Watch / iOS).
Planned data types: steps, calories burned, active minutes, heart rate, sleep, HRV.

Architecture for this integration will be designed when Phase 2 begins.

---

## Environment Variables

```
SUPABASE_URL=
SUPABASE_ANON_KEY=
PORT=3000
```

Stored in `.env` locally. `.env` is excluded from the repo. `.env.example` is committed with empty values.
