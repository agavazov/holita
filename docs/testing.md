# Focused validation

## Select the narrowest relevant target

Use named root npm targets with native runner selectors. Jest handles backend tests;
Angular CLI uses Vitest/jsdom; Playwright handles compiled-app browser checks.
Commands are non-watch. `npm test` is not the validation interface.

```bash
npm run test:fleet -- vehicles.service.spec.ts --skip-nx-cache
npm run test:fleet -- devices.service.spec.ts --testNamePattern="rejects" --skip-nx-cache
npm run test:core -- health.spec.ts --skip-nx-cache
npm run test:gateway -- health.spec.ts --skip-nx-cache
npm run test:admin -- --include=app/features/fleet/vehicles/vehicles-api.spec.ts --skip-nx-cache
```

Without a file, each named target selects its own current unit/bootstrap suite.
DB targets are separate and noncached. Do not accept zero executed tests, enable
`--passWithNoTests` or use watch mode. Read actual counts; mocks are not persistence proof.
Root tooling changes require `npm run lint`, `npm run typecheck` and `npm run build` plus
relevant behavioral checks. SDL/operations also require codegen, schema:check and test:schema.

## Domain checks

[Discocan checks](discocan/testing.md) cover Vehicles/Devices, Angular workspaces,
telemetry login, captured clients and browser behavior. [Ecommerce Store checks](ecommerce/stores.md#validation)
cover tenant-scoped Store discovery and persistence.

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
and inability to connect to development/Fleet databases. Fleet migrations create tenant-scoped Vehicle/Device indexes, a digit CHECK and a same-tenant/same-store restricted FK.
Database results must run fresh and cannot be treated as valid Nx cache hits.

## Real federation and browser smoke checks

```bash
npm run test:schema -- contracts.unit.spec.mts federation-guard.unit.spec.mts
npm run test:gateway:db -- federation.db.spec.mts
npm run test:smoke:admin -- angular-foundation.smoke.spec.mts angular-shell.smoke.spec.mts
```

Offline contracts tests compose all three subgraphs, validate all five explicit operation files and
assert the exact public query/mutation inventory. Karma Client runs against a local controlled
Karma HTTP server without live credentials. Guard tests reject unsafe local test URLs.
Federation fixture owns isolated Core/Fleet test schemas, Core seeds, real backend processes
and request observers. It proves Store discovery, Vehicle/Device relations and scope, CORS/header
bounds, availability, request-local Core validation and scoped CRUD while Core is stopped.
Gateway has no database dependency.

Angular fixtures serve the compiled production app with their own runtime configuration.
They own dedicated backend processes/schemas and never load private development licenses.
Browser fixtures seed Core and obtain real demo sessions; they create their own business records without running Fleet sample seeds. The Isolation tenant/store exists only in these test fixtures.
Browser targets build the admin and four backends, use Chromium, disable retries and retain
failure screenshots/traces under ignored test-results. Clean up task-started connections/processes.

## Current change-to-check mapping

| Change                                  | Focused checks                                                                      |
| --------------------------------------- | ----------------------------------------------------------------------------------- |
| Vehicle validation/query/persistence    | vehicles.service.spec.ts, vehicles.db.spec.ts                                       |
| Device IMEI/assignment/persistence      | devices.service.spec.ts, devices.db.spec.ts                                         |
| Runtime module/health                   | Fleet/Core/Gateway health.spec.ts as affected                                       |
| Karma account client/access             | karma-client.spec.ts, cars.service.spec.ts, Karma health.spec.ts                    |
| Karma global list/routing               | karma-workspace.spec.ts, angular-karma.smoke.spec.mts                               |
| SDL/operations                          | codegen, schema:check, contracts.unit.spec.mts                                      |
| Cross-service contracts/context         | federation.db.spec.mts                                                              |
| Store/language/default routing          | store-workspace.spec.ts, fleet-workspace.spec.ts, angular-foundation.smoke.spec.mts |
| Captured feature clients/forms/deletion | concrete vehicles/devices Angular suites                                            |
| Remote picker cancellation              | relation-picker.spec.ts, device-editor.spec.ts                                      |
| Shell/theme/mobile/keyboard             | angular-shell.smoke.spec.mts and matching visual review                             |
| Real CRUD and narrow views              | angular-vehicles.smoke.spec.mts, angular-devices.smoke.spec.mts                     |
| Root tooling                            | root lint/typecheck/build and relevant behavior                                     |

## Local diff versus PR affected selection

Inspect both tracked changes and new files; exclude the local task directory:

```bash
git diff --name-only HEAD -- . ':!.tmp/**' ':!.volumes/**'
git ls-files --others --exclude-standard -- . ':!.tmp/**' ':!.volumes/**'
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
are not restored across jobs. Node processes run on the runner host, with the existing
PostgreSQL-only Compose file. No cloud cache, secrets, deployment or extra service is needed.

The PR sequence is:

1. Record the base/head and the Nx-selected applications in the job summary.
2. Run format:check, schema:check and check:affected. The latter always lints/typechecks
   root tools and runs affected application lint/typecheck/build with generation dependencies.
3. If applications are selected, start PostgreSQL and provision both development and test
   roles/databases using db:setup and db:test:setup. Permission tests need both sets; CI
   does not migrate or seed the development databases. Fixtures migrate/seed their own schemas.
4. Run test:affected: offline schema-tool tests followed by affected unit/DB targets.
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
npm run projects -- --affected --files=apps/fleet/src/vehicles/vehicles.graphql
npm run projects -- --affected --files=apps/fleet/prisma/migrations/20261011000000_init/migration.sql
npm run projects -- --affected --files=compose.yaml
npm run projects -- --affected --files=.github/workflows/affected.yml
npm run projects -- --affected --files=docs/testing.md
npm run test:affected -- --files=apps/admin/src/app/features/fleet/vehicles/vehicles-api.ts --include=app/features/fleet/vehicles/vehicles-api.spec.ts --skip-nx-cache
```

Expected application sets are admin; all five; fleet/gateway/admin;
all five; all five; none, respectively. These explicit-file examples inspect the configured graph; actual
PR execution uses the event SHAs instead. Verify the history step with an available commit
and missing/invalid references; never treat a refused comparison as passing coverage.
actionlint is an external contributor tool, not an application dependency. A local syntax
or shell check does not prove that checkout, npm ci or browser installation works on GitHub.

## Full regression

`npm run test:full` explicitly runs schema tests, the configured test/test-db project targets
and the Angular Chromium smoke target. It is
reserved for a user/reviewer request and must never be invoked automatically during
implementation. It requires test databases and Chromium.
[Full regression (manual)](../.github/workflows/full-regression.yml) has workflow_dispatch
as its only trigger. In GitHub Actions, choose that workflow, Run workflow and the desired
branch. Manual dispatch requires the workflow on the default branch; see
[GitHub's manual-run guide](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow).
It installs prerequisites, runs format/schema/lint/typecheck/build and then test:full.
Do not equate a configured workflow with an executed acceptance run.
