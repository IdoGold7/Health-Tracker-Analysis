# Workflow

## Core Rule

One task per session. `current-task.md` defines it. Do not deviate.
Never commit or push without explicit approval. Write the code, test it, then stop and wait.

---

## Session Start

1. Read `docs/current-task.md` — this is the full scope of work
2. Read only the doc relevant to the task (e.g. `data-model.md` for schema work)
3. Do not read files unrelated to the task

## During a Task

- Write one unit of work → test it → move on
- One unit means one thing: a migration, a policy, a seed, a route, a component. Not a feature.
- Do not refactor while implementing
- Do not read or scan files outside the task scope
- If a problem is discovered outside the task scope, note it in `docs/current-task.md` under `## Flagged` — do not fix it now

## Session End

- Update `docs/current-task.md` to reflect what was completed and what is next
- Commit with a specific message: `feat: add food log insert route` not `update server`

---

## Branching

- `main` — stable only. Never commit broken code here.
- `feat/<name>` — one branch per feature
- Merge to main only when the feature works end-to-end and passes the quality checklist

---

## Commit Style

```
feat: add food log insert route
fix: correct grams check constraint
chore: add seed script for public foods
```

One thing per commit. No "various fixes" commits.
