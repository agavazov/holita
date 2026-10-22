# Testing

holita keeps a small test budget: at most 60 test cases in the whole repository, checked by
`npm run test:budget`. Tests exist only where a silent failure is expensive:

- Tenant/Branch isolation;
- raw SQL derived lists and database constraints;
- irreversible device writes;
- the cross-service error contract;
- critical journeys in the compiled admin;
- pure time-zone, unit, money and URL-codec logic.

The [delivery policy](../AGENTS.md#delivery-policy) decides when a test may be added.

## When to check

| When                | What to run                                                  |
| ------------------- | ------------------------------------------------------------ |
| While writing       | Nothing                                                      |
| Handing over a task | `npm run check`, plus the additions below                    |
| On request          | The whole smoke suite, `test:gateway:db` and `test:full`     |
| Pull request (CI)   | The complete affected checks, including federation and smoke |

`npm run check` works on the projects that the change affects, compared with `main` and including
uncommitted files:

1. `nx affected -t build,test,test-db` builds them, which is the type check of application code,
   then runs their unit and DB tests. Unaffected projects and unchanged inputs come from the Nx
   cache, and Nx runs independent tasks in parallel.
   - The GraphQL and Prisma generators rerun only when a `.graphql` file, `schema.prisma` or the
     generator itself changes.
2. `eslint --cache` lints only the files that changed since its last run.

The DB tests need PostgreSQL (`npm run db:up`, and `npm run db:test:setup` once). Separate
`typecheck` targets, which also cover specs, stories and tools, run in CI.

When handing over, also run:

- **Login, routing, transport or a main journey:** one `npm run test:smoke:admin -- <file>`.
- **`tools/` changes:** `npm run typecheck:tools`.
- **Root tooling:** `npm run lint`, `npm run typecheck` and `npm run build`.

## Unit targets

```bash
npm run test:fleet -- validation.spec.ts
npm run test:core
npm run test:karma-client
npm run test:admin -- --include=app/ui/format/zoned-time.spec.ts
```

Jest runs the backend specs. Angular CLI runs the admin specs with Vitest in jsdom, and
`apps/admin/src/test-setup.ts` stubs `matchMedia`, `ResizeObserver` and `scrollIntoView`. Admin
`--include` paths are relative to `apps/admin/src`.

- Read the executed count: zero tests is not a pass.
- Do not use watch mode or `--passWithNoTests`.
- Use `--skip-nx-cache` only to re-run a cached result you doubt.

## Real PostgreSQL checks

```bash
npm run db:up
npm run db:test:setup
npm run test:core:db
npm run test:fleet:db -- devices.db.spec.ts
```

Each DB spec file uses the dedicated test role. It creates its own random schema, applies the
reviewed `prisma/migrations/*/migration.sql` files to it in order over its own connection, and
drops only that schema. It does not start the Prisma CLI or record a migration table. The guarded
helpers reject development, foreign and non-local database identities.

Nx caches DB results locally. A DB target reruns when anything in its inputs changes: the
project's code, tests and migrations, the database tooling, `compose.yaml` or the shared globals.
`npm run check` therefore reports unchanged DB results from the cache.

These commands always run fresh with `--skip-nx-cache`: `test:core:db`, `test:fleet:db`,
`test:affected` (CI) and `test:full`.

The Fleet DB target runs its files on two Jest workers (`maxWorkers` in `jest.db.config.mjs`).

Never reset databases, truncate shared tables or use development connections.

## Federation

```bash
npm run router:install
npm run test:gateway:db
```

The script runs the `gateway:test-federation` Nx target. That target is not part of
`npm run check`, because every backend change affects the gateway. CI runs it through
`test:affected`.

`tools/graphql/federation.db.spec.mts` builds the subgraphs and starts:

- Core, Fleet and Karma Client, each with an isolated test schema;
- the native Router;
- a local Karma HTTP fixture, so no live credentials are needed.

It checks:

- Router Branch discovery and Vehicle→Branch federation;
- tenant isolation, including direct `_entities` calls;
- the public error format with `fieldErrors` and request IDs;
- Router redaction of internal errors.

The suite owns and cleans up all its processes and schemas.

## Browser smoke

```bash
npm exec -- playwright install chromium
npm run test:smoke:admin -- angular-vehicles.smoke.spec.mts
```

The target builds the admin and the subgraphs. It then runs Playwright in Chromium against the
compiled production app, the native Router and real subgraphs with isolated schemas.

- Each Playwright worker starts one backend.
- Each test signs in to its own new Tenant with the Branches Discordia and Sandbox, so tests share
  no business data.
- The suite runs on one worker.

The suite covers:

- tenant login and isolation;
- Branch A → B → A;
- Vehicles, Devices and Drivers;
- General settings;
- Maintenance;
- one Karma journey.

Failure traces stay under the ignored `test-results/` directory. Failure screenshots are opt-in
with `HOLITA_BROWSER_SCREENSHOTS=1`.

## Storybook

Storybook (`npm run storybook:admin`) is a development tool, not a test suite. Its stories render
connected screens from typed GraphQL fixtures. The Accessibility panel runs an axe check on
request.

## Affected selection and CI

```bash
npm run projects -- --affected --base=HEAD
npm run check:affected -- --base=BASE --head=HEAD
npm run test:affected -- --base=BASE --head=HEAD
```

For local uncommitted work, use `--base=HEAD` without `--head`. A missing reference is a selection
error; do not report it as "no affected projects".

[PR affected](../.github/workflows/affected.yml) runs on pull requests against the event's exact
base and head commits, and fails when history is missing. It runs, in order:

1. `format:check`, `test:budget` and `schema:check`;
2. `check:affected` (lint, typecheck and build);
3. `test:affected` (affected unit, DB and federation targets);
4. the smoke suite, when the admin is affected.

[Full regression](../.github/workflows/full-regression.yml) is `workflow_dispatch` only. It runs
`npm run test:full`: every unit, DB and federation target, then the smoke suite.

Validate workflow changes with actionlint.
