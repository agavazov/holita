---
name: holita-focused-validation
description: Check a holita change once, when handing over the task, and respect the test budget. Use when implementing or verifying repository changes.
---

# Focused validation

Apply the [delivery policy](../../../AGENTS.md#delivery-policy) and the
[verification rules](../../../AGENTS.md#verification). The commands are in
[testing](../../../docs/testing.md).

1. **While writing:** run no checks. Rerun a single failing spec only while you fix it, for
   example `npm run test:fleet:db -- devices.db.spec.ts` or
   `npm run test:admin -- --include=app/ui/format/zoned-time.spec.ts`.
2. **When handing over:** run `npm run check` once.
   - It builds the affected projects (the build is the type check) and runs their unit and DB
     tests in parallel, from the Nx cache.
   - It lints only the changed files.
   - PostgreSQL must be up (`npm run db:up`).
   - Add one `npm run test:smoke:admin -- <file>` when login, routing, transport or a main
     journey changed.
   - Add `npm run typecheck:tools` when `tools/` changed.
3. **Only on request:** the whole smoke suite, `test:gateway:db`, `test:full` and Storybook
   review.

Do not use watch mode, `--passWithNoTests` or `--skip-nx-cache` by default. Database checks use
only the guarded per-run schema helpers, never development connections, resets or truncation.

A new test needs a reason from the delivery policy, and `npm run test:budget` must still pass.
Prefer extending an existing case. Report the commands with their results, and say what you did
not verify.
