# Current Task

## Objective
Scaffold the Expo client and wire up Supabase auth.
No real UI. A dev screen that proves the connection works.

## In Scope
- Initialize Expo project inside `client/` using the blank TypeScript template
  with Expo Router. Use npm.
- Install and configure Supabase client (`client/lib/supabase.ts`)
- Env vars must be named `EXPO_PUBLIC_SUPABASE_URL` and
  `EXPO_PUBLIC_SUPABASE_ANON_KEY` in `.env` (update `.env.example` to match)
- Persistence: AsyncStorage + AppState auto-refresh per Supabase React Native
  auth guide. No SQLite polyfill.
- Single screen (`client/app/index.tsx`): two text inputs (email, password),
  Sign In button, raw session JSON dumped below. No styling required.
- `client/app/_layout.tsx` must exist (Expo Router requires it)
- No other screens

## Folder Structure
After scaffold, `client/` must contain at minimum:
  app/, components/, hooks/, lib/, constants/
Expo Router may generate additional files — that is acceptable.
Do not delete generated scaffold files without a reason.

## Out of Scope
- Sign up flow (create test user manually in Supabase → Authentication → Users)
- Any styling or real UI
- Any other screens
- Express server

## Definition of Done
- [ ] App starts in Expo Go without errors
- [ ] Sign in with a real Supabase test user succeeds
- [ ] Session JSON is visible on screen after sign in
- [ ] Kill and reopen app — session persists (user is still signed in)
- [ ] Web support is not required — test on mobile or Expo Go only