# Focused validation

## Select the narrowest relevant target

Use named root npm targets with native runner selectors. Jest handles backend tests;
Angular CLI uses Vitest/jsdom; Playwright handles compiled-app browser checks.
Commands are non-watch. `npm test` is not the validation interface.

```bash
npm run test:fleet -- vehicles.service.spec.ts --skip-nx-cache
npm run test:fleet -- devices.service.spec.ts --testNamePattern="rejects" --skip-nx-cache
npm run test:core -- health.spec.ts --skip-nx-cache
npm run test:gateway -- router.runtime.spec.mts
npm run test:karma-client -- cars.spec.ts --skip-nx-cache
npm run test:admin -- --include=app/features/fleet/vehicles/vehicles-api.spec.ts --skip-nx-cache
```

Without a file, each named target selects its own current unit/bootstrap suite. Gateway
bootstrap checks run the installed native Router with unavailable subgraphs, without a
database, and verify health, a local GraphQL query, unknown routes and oversized headers.
DB targets are separate and noncached. Do not accept zero executed tests, enable
`--passWithNoTests` or use watch mode. Read actual counts; mocks are not persistence proof.
Root tooling changes require `npm run lint`, `npm run typecheck` and `npm run build` plus
relevant behavioral checks. SDL/operations also require codegen, schema:check and test:schema.

## Domain checks

[Discocan checks](discocan/testing.md) cover Fleet Vehicles, Devices, Drivers, Vehicle groups, telemetry, trips, alerts, service tasks and the list contract, Angular workspaces,
telemetry login, captured clients and browser behavior. [Ecommerce Branch checks](ecommerce/branches.md#validation)
cover tenant-scoped Branch discovery and persistence.

## Real PostgreSQL checks

Provision development and dedicated test roles first:

```bash
npm run db:up
npm run db:setup
npm run db:test:setup
npm run test:core:db -- persistence.db.spec.ts
npm run test:fleet:db -- vehicles.db.spec.ts devices.db.spec.ts
```

Guarded helpers reject development/foreign/nonlocal identities and URL options. Each run deploys
reviewed migrations into its own random schema, closes connections and drops only that schema.
No broad resets/truncation occur. Core persistence tests cover seed idempotency, schema isolation
and inability to connect to development/Fleet databases. Fleet migrations create tenant-scoped indexes for the master data and activity tables, the IMEI digit CHECK, the master data and activity CHECKs, and same-tenant/same-branch restricted composite FKs; `constraints.db.spec.ts` proves them and the generated unique index names. Raw Fleet SQL runs against the per-run schema through schema-qualified table names.
Database results must run fresh and cannot be treated as valid Nx cache hits.

## Real federation and browser smoke checks

```bash
npm run test:schema -- contracts.unit.spec.mts federation-guard.unit.spec.mts
npm run router:install
npm run router:check
npm run test:gateway:db -- federation.db.spec.mts
npm run test:smoke:admin -- angular-foundation.smoke.spec.mts angular-shell.smoke.spec.mts
```

Offline contracts tests compose the Core, Fleet and Karma Client subgraphs, validate the explicit feature-owned operation files and
assert the exact public query/mutation inventory. Karma Client runs against a local controlled
Karma HTTP server without live credentials. Guard tests reject unsafe local test URLs.
Federation fixture owns isolated Core/Fleet test schemas, Core seeds, real backend processes
and request observers. It proves Branch discovery, Vehicle/Device relations and scope, Driver and
Vehicle group CRUD with Core creation checks, stored group/driver references, sanitized
`fieldErrors` for duplicates and malformed dates, protected group deletion, CORS/header
bounds, availability, request-local Core validation and scoped CRUD while Core is stopped.
Gateway has no database dependency. The fixture uses only the pinned Apollo Router binary,
waits on its dedicated health listener and closes it before subgraphs and test schemas.
No fixture starts a JavaScript Gateway or selects another runtime.

Angular fixtures serve the compiled production app with their own runtime configuration.
They own dedicated backend processes/schemas and never load private development licenses.
Browser fixtures seed Core and obtain real demo sessions; they create their own business records without running Fleet sample seeds. The Isolation tenant/branch exists only in these test fixtures.
Browser targets build the admin and three subgraphs, prepare Router, use Chromium, disable retries and retain
failure screenshots/traces under ignored test-results. Clean up task-started connections/processes.

## Storybook visual review

```bash
npm run test:visual:admin
```

The target builds the static [admin Storybook](development.md#admin-storybook) and captures the
stories listed in [storybook-visual.spec.mts](../tools/browser/storybook-visual.spec.mts) at
1440×900 and 390×844 with Chromium, `bg-BG`, `Europe/Sofia`, a fixed clock and device scale 1.
Each capture waits until no fixture request has been in flight for 400 ms.

- Every run writes reviewable candidates to the ignored `test-results/storybook-visual-candidates/`
  and attaches them to the HTML report in `playwright-report/storybook-visual/`.
- Approved baselines are per checkout in the ignored `.references/review/storybook-baselines/`.
  Missing or changed baselines fail the run; Playwright never creates them (`updateSnapshots: 'none'`).
  A run without baselines reports "A snapshot doesn't exist": candidates exist, nothing is approved.
- Only after a person approves the candidates, record them from a fresh build:
  `npx playwright test --config tools/browser/storybook-visual.config.mts --update-snapshots=all`.
  Never update baselines or loosen comparison to make the check pass.
- Matching screenshots show that pixels equal the approved state; they do not establish UX quality,
  accessibility or behavior. Unit and smoke checks keep covering behavior.

## Router contract check

After [installing Apollo Router](development.md#apollo-router) and provisioning
the dedicated test databases above, run:

```bash
npm run test:gateway:router
```

This noncached Nx target builds the three subgraphs, prepares Router and runs `router.smoke.spec.mts` through
Jest. It uses the same guarded federation fixture with isolated Core/Fleet schemas,
real subgraphs and a local Karma HTTP server. Router runs on ephemeral loopback ports
using the checked-in YAML and generated supergraph, with telemetry disabled and no GraphOS
credentials. The fixture owns and cleans up all its processes, connections and schemas.
It checks demo login, Branch discovery, Vehicle-to-Branch federation, supplied request ID/Branch
headers, Tenant/Branch denial, signed Karma reads and configured-origin CORS. Successful
responses, public business messages and sanitized error extensions have explicit expected values.

The same suite checks valid/missing/invalid request IDs, concurrent error correlation,
real public business errors, variable coercion and a five-second timeout against a paused
Karma Client process, followed by recovery. Controlled Core observer responses separately
exercise unknown-code redaction, extension filtering, fieldErrors bounds and malformed/failed
upstream HTTP responses. The real Core/Fleet tests establish service-boundary behavior;
fault-injected responses establish error formatting. The fixture resumes the paused process
and clears injected responses even when assertions fail.

Early parse/schema-validation cases assert native HTTP 400 codes, configured-origin CORS,
absence of the application request ID and no downstream execution. Native diagnostic wording and error counts follow the pinned Router release. The admin transport's
HTTP-error fallback and client request ID are checked separately with mocked HTTP responses:

```bash
npm run test:admin -- --include=app/core/graphql/graphql-options.spec.ts --skip-nx-cache
```

The binary must already be installed; a missing or different version fails the check.
This target remains separately selectable from `test:gateway:db`. `test:affected` selects
its noncached `test-router` target when Gateway is affected; `test:full` also includes it.
The normal federation/browser suites use Router. The Router suite itself does not
establish browser compatibility; use the compiled-admin browser targets for that coverage. Early native failures are part of the documented
[Router error behavior](development.md#apollo-router), including the native early HTTP 400 responses.

## Gateway benchmark

On Linux/WSL, after installing Router and provisioning the dedicated test databases, run:

```bash
npm run benchmark:gateway
# Short executable check of the same scenarios and cleanup:
npm run benchmark:gateway -- --seconds=2 --warmup=1 --rounds=1
```

The noncached Nx target builds the three subgraphs, prepares Router and uses the guarded
federation fixture. Router routes to real Core/Fleet processes with isolated schemas and
50 Vehicles/50 Devices created through GraphQL. Subgraph request observers are bypassed,
including Fleet's Core validation client. Karma uses the local HTTP fixture, never the live account.
The benchmark owns its processes/schemas and cleans them up on success, failure or interruption.

Five scenarios cover a gateway-only `__typename` control, signed Branch discovery, 20-row
Vehicle-to-Branch federation, 20-row Devices with Vehicle/Branch relations and Karma cars.
Preflight checks the seeded page sizes; every measured response checks data against preflight,
HTTP status, GraphQL errors and its echoed request ID. The first failing sample stops the run.
A JSONL trace preserves completed samples and bounded fixture logs on failure/interruption;
a complete JSON summary is written only after every sample succeeds.
This measures successful reads; mutation/error/timeout compatibility belongs to the tests above.

Each scenario uses closed-loop concurrency 1 and 16. Every sample has two seconds of warmup
and eight seconds of measurement by default, with three rounds against Router.
This measures the current native runtime; it does not start a JavaScript comparison process. Latency includes the complete parsed HTTP response;
throughput includes completion of in-flight requests. JSON reports retain individual rounds,
median round mean/p50/p95/throughput/CPU, throughput range and maximum sampled RSS under ignored
`test-results/gateway-benchmark/`. The `seconds`, `warmup` and `rounds` options accept positive
integers bounded at 60, 30 and 10 respectively.

Gateway CPU comes from Linux `/proc/PID/stat` user/system ticks (100% equals one logical core);
RSS is the approximate resident memory sampled from `/proc/PID/status` every 100 ms. These
metrics exclude subgraphs and PostgreSQL. Harness CPU is reported separately and includes the
local Karma server. See the [Linux process metrics documentation](https://www.kernel.org/doc/html/latest/filesystems/proc.html).
The report records the observed response Content-Encoding with the default Node fetch
Accept-Encoding negotiation; measurements include the configured compression. Run without concurrent builds/tests/dev servers. Shared-host scheduling, the load generator,
subgraphs and the database can limit throughput; a saturated harness invalidates a gateway
capacity claim. This fixed-concurrency measurement does not establish production capacity,
a fixed-arrival-rate latency SLA, cold-start performance or real Karma network latency.

## Current change-to-check mapping

| Change                                  | Focused checks                                                                                                                                                                                                                                                                         |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Vehicle validation/query/persistence    | vehicles.service.spec.ts, vehicles.db.spec.ts                                                                                                                                                                                                                                          |
| Device IMEI/assignment/persistence      | devices.service.spec.ts, devices.db.spec.ts                                                                                                                                                                                                                                            |
| Driver/Vehicle group rules/persistence  | drivers.service.spec.ts, drivers.db.spec.ts, vehicle-groups.service.spec.ts, vehicle-groups.db.spec.ts                                                                                                                                                                                 |
| Fleet list contract/validation/scalars  | validation.spec.ts, scalars.spec.ts and the affected module's service and db specs                                                                                                                                                                                                     |
| Fleet telemetry/trips/alerts/service    | sql.spec.ts, vehicle-state.spec.ts, the telemetry/trips/events/service-tasks service and db specs, vehicles/devices/drivers db specs for derived values, federation.db.spec.mts                                                                                                        |
| Fleet migration/CHECKs/unique mapping   | initial-migration.db.spec.ts, branch-migration.db.spec.ts, constraints.db.spec.ts, seeds.db.spec.ts                                                                                                                                                                                    |
| Fleet business errors through Router    | router.smoke.spec.mts (`npm run test:gateway:router`), federation.db.spec.mts                                                                                                                                                                                                          |
| Runtime module/health                   | Fleet/Core health.spec.ts; Gateway router.runtime.spec.mts                                                                                                                                                                                                                             |
| Karma account client/access             | accounts.spec.ts, history.spec.ts, location.spec.ts, edata.spec.ts, edata.service.spec.ts, cars.spec.ts, cars.service.spec.ts, Karma health.spec.ts                                                                                                                                    |
| Karma truck/reference reads and routing | accounts.spec.ts, history.spec.ts, location-references.spec.ts, karma-workspace.spec.ts, edata-page.spec.ts, angular-karma-phase4.smoke.spec.mts, angular-karma-phase3.smoke.spec.mts, angular-karma-phase2.smoke.spec.mts, angular-karma.smoke.spec.mts, angular-edata.smoke.spec.mts |
| SDL/operations                          | codegen, schema:check, contracts.unit.spec.mts                                                                                                                                                                                                                                         |
| Cross-service contracts/context         | federation.db.spec.mts                                                                                                                                                                                                                                                                 |
| Branch/language/default routing         | branch-context.spec.ts, fleet-workspace.spec.ts, angular-foundation.smoke.spec.mts                                                                                                                                                                                                     |
| Captured feature clients/forms/deletion | concrete vehicles/devices Angular suites                                                                                                                                                                                                                                               |
| Remote picker cancellation              | relation-picker.spec.ts, device-editor.spec.ts                                                                                                                                                                                                                                         |
| Shell/theme/mobile/keyboard             | angular-shell.smoke.spec.mts and matching visual review                                                                                                                                                                                                                                |
| Real CRUD and narrow views              | angular-vehicles.smoke.spec.mts, angular-devices.smoke.spec.mts                                                                                                                                                                                                                        |
| Admin stories/fixtures/presentation     | admin typecheck and lint, build:storybook:admin, test:visual:admin with candidate review                                                                                                                                                                                               |
| Root tooling                            | root lint/typecheck/build and relevant behavior                                                                                                                                                                                                                                        |

## Local diff versus PR affected selection

Inspect both tracked changes and new files; exclude the local task directory:

```bash
git diff --name-only HEAD -- . ':!.credentials/**' ':!.tmp/**' ':!.misc/**' ':!.volumes/**'
git ls-files --others --exclude-standard -- . ':!.credentials/**' ':!.tmp/**' ':!.misc/**' ':!.volumes/**'
npm run projects -- --affected --base=HEAD
```

For a PR, use its actual base/head commits:

```bash
npm run check:affected -- --base=BASE --head=HEAD
npm run test:affected -- --base=BASE --head=HEAD
```

Replace BASE and HEAD with existing references. For local uncommitted work use
`--base=HEAD` without `--head`; Nx includes local/untracked changes. Do not use only the
last committed diff as a proxy for the agent's current edits. A missing reference is a
selection error; do not report it as no affected projects. First-commit/missing-history
cases need an explicit choice of all relevant projects or a known base.
PR CI requires the known base and fails when history is missing; it never substitutes
an empty selection or automatically starts full regression.

Nx uses main as its default base, but explicit comparisons avoid ambiguity. Shared
configuration/lockfile changes can affect all five applications. Nx's project graph does
not establish which tests cover a runtime change; choose behavioral checks from the
mapping above. Local pure checks may be cached using the configured inputs. Use
`--skip-nx-cache` when demonstrating the actual runner or testing current runtime behavior.
Affected testing first runs the small offline schema-tool suite, then Nx selects the
affected application unit/DB targets. Shared contracts and operation changes affect all
five applications because all generators validate the complete contract set. Gateway's
whole-graph test builds the real backend dependencies. Application code import boundaries
remain enforced separately from these task/contract relationships.

## GitHub Actions

[PR affected](../.github/workflows/affected.yml) runs on pull_request with read-only contents
permission. It checks out the event's exact head with fetch-depth: 0 and validates both
event SHAs, the checkout and a common ancestor before invoking Nx. It does not assume
origin/main or HEAD~1 exists. Missing/shallow/unrelated history fails with a diagnostic;
restore the event commits or use a PR with a known common base and rerun. A first commit
without a PR base is not an automatic affected run.
This uses [checkout's full-history and PR-head options](https://github.com/actions/checkout#scenarios)
and [Nx's base/head comparison](https://nx.dev/docs/features/ci-features/affected).

Each workflow uses Ubuntu 24.04, Node from .nvmrc and the packageManager npm version, then
npm ci. Only npm's download cache is restored; node_modules, Nx results and live DB results
are not restored across jobs. Native Router and Node processes run on the runner host, with the existing
PostgreSQL-only Compose file. No cloud cache, secrets, deployment or extra service is needed.

The PR sequence is:

1. Record the base/head and the Nx-selected applications in the job summary.
2. Run format:check and schema:check. When Gateway or admin is selected, install and validate
   the pinned Router binary before check:affected, because Gateway build validates its configuration.
   check:affected always lints/typechecks root tools and runs affected application
   lint/typecheck/build with generation dependencies. Gateway has no TypeScript runtime to typecheck.
3. If applications are selected, start PostgreSQL and provision both development and test
   roles/databases using db:setup and db:test:setup. Permission tests need both sets; CI
   does not migrate or seed the development databases. Fixtures migrate/seed their own schemas.
4. Run test:affected: offline schema-tool tests followed by affected unit/DB/Router targets.
5. If the admin is affected, install Chromium with its Linux dependencies. Run
   test:smoke:admin for Angular. Backend runtime dependencies can select the admin
   without a frontend source change.
6. Stop Compose even after a failed check, without deleting volumes. Test fixtures own their
   application processes and per-run schemas; failures stay visible in the job log.

Docs-only changes can select no applications. The summary explains that no application
tests ran; format, root-tool and schema checks still run. This is not evidence of product
behavior. Shared configuration/workflow/ignore changes intentionally select all five apps;
the PR still uses affected targets and never calls test:full.

When changing CI, validate both YAML/expressions and shell steps using actionlint (with
ShellCheck available), and check real input impact without executing broad test suites:

```bash
actionlint .github/workflows/affected.yml .github/workflows/full-regression.yml
npm run projects -- --affected --files=apps/admin/src/app/features/fleet/vehicles/vehicles-api.ts
npm run projects -- --affected --files=apps/fleet/src/modules/vehicles/vehicles.graphql
npm run projects -- --affected --files=apps/fleet/prisma/migrations/20261011000000_init/migration.sql
npm run projects -- --affected --files=compose.yaml
npm run projects -- --affected --files=.github/workflows/affected.yml
npm run projects -- --affected --files=docs/testing.md
npm run test:affected -- --files=apps/admin/src/app/features/fleet/vehicles/vehicles-api.ts --include=app/features/fleet/vehicles/vehicles-api.spec.ts --skip-nx-cache
```

Expected application sets are admin; all five; fleet/gateway/admin;
core/fleet/gateway/admin; all five; none, respectively. These explicit-file examples inspect the configured graph; actual
PR execution uses the event SHAs instead. Verify the history step with an available commit
and missing/invalid references; never treat a refused comparison as passing coverage.
actionlint is an external contributor tool, not an application dependency. A local syntax
or shell check does not prove that checkout, npm ci or browser installation works on GitHub.

## Full regression

`npm run test:full` explicitly runs schema tests, the configured test/test-db/test-router project targets
and the Angular Chromium smoke target. It is
reserved for a user/reviewer request and must never be invoked automatically during
implementation. It requires the pinned Router binary, test databases and Chromium.
[Full regression (manual)](../.github/workflows/full-regression.yml) has workflow_dispatch
as its only trigger. In GitHub Actions, choose that workflow, Run workflow and the desired
branch. Manual dispatch requires the workflow on the default branch; see
[GitHub's manual-run guide](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow).
It installs dependencies and Router, runs format/schema/lint/typecheck/build and then test:full.
Do not equate a configured workflow with an executed acceptance run.
