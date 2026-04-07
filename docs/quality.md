# Quality

## Definition of Done

A unit of work is done when:
1. It does what `current-task.md` says it should do
2. It does not break anything it touches
3. It has been manually tested (see below)

Not done until all three are true.

---

## Test Before Moving On

For every unit of work, confirm:

- [ ] The happy path works as expected
- [ ] Invalid input is rejected (bad data, missing fields, wrong types)

For routes and data operations, also confirm:

- [ ] Auth is enforced — unauthenticated request is rejected
- [ ] RLS is enforced — test with two separate authenticated users (real client session or curl/REST client with JWT). Confirming data access as one user is not an RLS test.

For Express routes, test with curl or a REST client. For Supabase direct ops, test in the Supabase dashboard or client.

---

## Do Not

- Do not test by reading the code — run it
- Do not move to the next task if the current one isn't working
- Do not write a test for a future edge case — test only what exists now
- Do not scan the full codebase to "make sure nothing broke" — run the affected path only

---

## When Something Is Broken

Fix it before moving on. If the fix is out of scope (touches something unrelated), flag it in `docs/current-task.md` under `## Flagged` and leave it.

---

## Before Merging to Main

- All tasks in the feature are done and tested
- App starts without errors
- The feature works end to end — happy path and rejection of invalid input
- Nothing the feature touches is broken
