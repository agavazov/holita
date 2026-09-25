# Focused validation

## Select the narrowest relevant target

Backend tests use Jest/ts-jest in ESM mode; Node's experimental VM modules flag is supplied
by the application script. Admin uses Vitest with jsdom, Testing Library matchers and
cleanup. Test commands are non-watch. There is no root `test` script or custom selector
dispatcher.
Admin test files run one at a time because Nx already parallelizes project tasks.
Text-entry scenarios use normal clipboard events where per-keystroke behavior is not under
test, reducing DOM work. Admin cases have a bounded 30-second budget for multi-step
Ant Design/Refine workflows sharing CPU with backend and DB checks. Assertion waits,
file isolation and failure reporting remain unchanged; tests do not retry on failure.
Nx test targets use its standard run-commands executor so quoted case names retain their
argument boundaries. Other application tasks are inferred from their package scripts.
Root named test commands explicitly use Nx's static output so successful runner summaries
and executed counts remain visible, including affected/full/browser commands. This does
not disable caching; use --skip-nx-cache when fresh execution is required.

From the repository root, select a backend file or a case within it:

```bash
npm run test:products -- health.spec.ts
npm run test:products -- health.spec.ts --testNamePattern="responds without store context"
npm run test:core -- health.spec.ts
npm run test:gateway -- health.spec.ts
npm run test:products -- products.service.spec.ts
npm run test:products -- products.service.spec.ts --testNamePattern="rejects invalid input"
```

Each backend health suite starts its actual AppModule on an ephemeral loopback port,
checks HTTP responses without a store header/database, and closes the application.
Gateway bootstrap also checks that oversized baggage headers receive HTTP 431 before
GraphQL handling. The real federation file repeats that check against compiled services
and verifies that neither subgraph receives the rejected request.
These are bootstrap tests, not proof of store isolation or product behavior.
The Products service file tests validation and no-write decisions with mocked dependency
boundaries. Its results do not substitute for the real DB and federation files below.

`test:admin` selects files matching `src/**/*.test.{ts,tsx}`:

```bash
npm run test:admin -- product-form.test.tsx
npm run test:admin -- data-provider.test.ts
npm run test:admin -- store-workspace.test.tsx
npm run test:admin -- store-workspace.test.tsx --testNamePattern="captures a pending create" --skip-nx-cache
```

ProductForm tests cover validation/defaults/trimming/edit values, Unicode limits, unsupported
NUL input and pending controls.
Use Vitest's long --testNamePattern option through Nx; its short -t conflicts with Nx's
own target option and does not reach the test runner.
Provider tests execute the actual official GraphQL provider with generated documents and
controlled HTTP responses. Store-workspace tests render the actual application, router,
Refine hooks/cache and Ant Design controls. They cover selection, pagination, search/status
filters, retry/empty states, unavailable stores, cached switches, delayed reads and pending create/update/delete.
They also verify that navigation between editors within one store isolates mutation state.
The HTTP boundary is controlled; these are not proof of real backend persistence.
Vitest inlines the Refine GraphQL/router ESM packages so their imports are resolved by Vite
as in the browser. jsdom supplies no layout engine; setup shims matchMedia and omits the
unsupported getComputedStyle pseudo-element argument. Real browser checks are separate.

Without a file, `test:core`, `test:products`, `test:gateway` and `test:admin` intentionally
select only that application's current unit/bootstrap suite. Database suites have
separate named targets; browser tests use test:smoke. No selector must silently fall back to every project, and
`--passWithNoTests` must not be enabled. A missing file or a case pattern that executes
zero tests is not successful validation, even if a runner exits zero for skipped cases.

## Real PostgreSQL checks

```bash
npm run db:up
npm run db:setup
npm run db:test:setup
npm run test:core -- test-database-url.unit.spec.ts
npm run test:core:db -- persistence.db.spec.ts
npm run test:products:db -- persistence.db.spec.ts --testNamePattern="rejects duplicate SKU"
```

Normal test targets do not connect to a database. `test:core:db` and `test:products:db`
use Jest's separate jest.db.config.mjs and select test/**/*.db.spec.ts. Each run guards
the local test URL, creates a random schema in its dedicated test database, runs the
actual checked-in migrations, and passes that schema to its service's Prisma adapter.
Cleanup disconnects the client and drops only the schema created by that run.
Tests never use development URLs, a public schema reset, shared truncation, or mocked
Prisma as evidence of persistence correctness. The permission cases expect both dev/test
databases to have been provisioned, but do not need development migrations or seeds.

URLs must use the exact service test database and role, a loopback host, a password and
no URL options. CORE_TEST_DATABASE_URL and PRODUCTS_TEST_DATABASE_URL configure them;
development URL variables cannot redirect DB tests. Credentials differ from development.
Override the test URLs too if changing the PostgreSQL port. Never point test variables at
development data. Unit guard tests exercise refusal before any connection is opened.

Persistence files cover migrated columns/defaults, repeatable seeds preserving edits,
simultaneous schema isolation, role-level database isolation, and product SKU uniqueness
within/across stores. They do not prove GraphQL/request-level store isolation, store
existence validation or browser behavior. Prisma requires explicit store filters from
business repositories; the database is not row-level authorization.

Feature HTTP/DB files are separate focused selections:

```bash
npm run test:core:db -- stores.db.spec.ts
npm run test:products:db -- products.db.spec.ts
npm run test:products:db -- products.db.spec.ts --testNamePattern="foreign IDs"
npm run test:gateway:db -- federation.db.spec.mts
```

Stores tests use real Nest GraphQL and PostgreSQL for lookup/list/reference behavior.
Products tests use the real GraphQL module, service and repository against PostgreSQL;
only the core-client boundary is replaced. They cover CRUD, trimming/defaults, conflicts,
pagination, missing/malformed context, foreign IDs, entity representations and masked errors.
Unicode boundary values are persisted and NUL input is rejected without writes.

Gateway's noncached DB target builds the three backends and runs the fixture in
tools/graphql/federation.db.spec.mts. It migrates/seeds new schemas using dedicated test
roles, starts actual compiled Node applications on ephemeral ports, and observes HTTP
headers through forwarding test servers. No business service or Prisma client is mocked.
It verifies both stores, CRUD/scoping, Product-to-Store federation, concurrent contexts,
creation validation reuse and behavior with the actual core process stopped. Cleanup
stops only its own processes and drops only its own schemas. This is a focused backend
integration target, not a browser/UI or full regression test.

`npm run test:schema -- contracts.unit.spec.mts` checks real composition/operations and
negative changes offline. The separate federation-guard.unit.spec.mts file tests the
whole-graph fixture's URL guards without opening databases.

The Nx `test-db` target has cache:false; any displayed cache hit belongs to generation,
not the live database test. Native file and --testNamePattern selection works unchanged.
Both targets are included in test:affected and the manually requested test:full command.
Prepare databases before an affected run that includes them. If a process is forcibly
killed, a test schema may remain; investigate that specific schema instead of deleting
all test schemas, which could belong to another active run.

## Real browser smoke checks

Install the browser once (Linux system dependencies may require sudo):

```bash
npm exec -- playwright install --with-deps chromium
npm run db:up
npm run db:setup
npm run db:test:setup
npm run test:smoke -- products.smoke.spec.mts
npm run test:smoke -- products.smoke.spec.mts --grep="pending mutation"
```

The noncached admin:test-smoke target builds all four apps, then invokes Playwright directly.
It uses one headless Chromium worker with no automatic retries. Each test creates actual
core/products/gateway processes and fresh migrated/seeded schemas through the guarded
federation fixture. Vite serves the real admin on an ephemeral port; its gateway URL and
the gateway CORS origin match that test instance. Development URLs cannot redirect the
fixture into development databases. Cleanup closes Vite, backend processes and test schemas.

The scenarios cover CRUD and same-SKU rules in both stores, a delayed real product
response, a pending real creation while switching to another store's unsaved form,
and browser history navigation between editors in the same store during a pending write.
Only response delivery is delayed by the latter scenarios; backend requests execute normally.
Browser screenshots/traces use ignored test-results/browser. These tests do not verify a
fresh dependency install or CI execution. Chromium is the configured browser; Firefox and
WebKit are outside this target. The manually invoked test:full also includes test:smoke.

## Current change-to-check mapping

| Change                                            | Applicable check                                                                                                                                    |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Backend bootstrap or health route                 | That service's health.spec.ts, typecheck/build, and startup when main.ts changes                                                                    |
| Backend PORT or shutdown handling                 | Run the affected service with a valid override and invalid PORT; verify exit and released port                                                      |
| Admin build or test configuration                 | Admin typecheck/build; verify runner selection; add relevant behavioral tests when interactive code exists                                          |
| Root TypeScript/Jest/Nx/dependency configuration  | Root lint/typecheck/build and relevant explicit backend files; record that all projects may be affected                                             |
| Import boundaries                                 | ESLint on the affected source; verify a prohibited cross-application import is rejected                                                             |
| Prisma schema, client, migration or seed          | Owning service's persistence.db.spec.ts, db:validate, typecheck/build; verify repeat seed behavior                                                  |
| Test URL guard or cleanup                         | Owning service's test-database-url.unit.spec.ts and persistence.db.spec.ts; simultaneous-schema case                                                |
| Compose or database provisioning                  | Repeated db:setup/db:test:setup, both persistence DB files, and compare development rows before/after db:down/up                                    |
| Product service validation                        | products.service.spec.ts first; products.db.spec.ts for transport/persistence behavior                                                              |
| Product repository/store context/entity reference | products.db.spec.ts; federation.db.spec.mts for gateway and real service boundaries                                                                 |
| SDL, named operations or generation               | schema:check, test:schema, codegen and affected typecheck/build; federation file for runtime contract changes                                       |
| Core client or gateway context/communication      | federation.db.spec.mts, especially validation reuse, concurrent headers and stopped core                                                            |
| Stores resolver/repository                        | stores.db.spec.ts; federation.db.spec.mts when public/federated behavior changes                                                                    |
| Product form or controls                          | product-form.test.tsx; store-workspace.test.tsx for submission/navigation changes                                                                   |
| Admin GraphQL mapping or headers                  | data-provider.test.ts; schema:check/codegen for operation edits; products.smoke.spec.mts for real transport                                         |
| Store routes, query cache or mutation lifecycle   | store-workspace.test.tsx and focused test:smoke delayed-response/pending-mutation cases                                                             |
| CI workflow, affected selection or ignore rules   | actionlint, Git-history failure checks, explicit Nx changed-file examples below, root lint/typecheck/build and a focused test through test:affected |

Do not claim database, schema, gateway federation or store-switch coverage from health
suites. Keep this mapping aligned with the changed runtime contracts.

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
configuration/lockfile changes can affect all four applications. Nx's project graph does
not establish which tests cover a runtime change; choose behavioral checks from the
mapping above. Local pure checks may be cached using the configured inputs. Use
`--skip-nx-cache` when demonstrating the actual runner or testing current runtime behavior.
Affected testing first runs the small offline schema-tool suite, then Nx selects the
affected application unit/DB targets. Shared contracts and operation changes affect all
four applications because all generators validate the complete contract set. Gateway's
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
5. If admin is affected, install Chromium with its Linux dependencies and run test:smoke.
   Backend runtime dependencies can select admin even without a frontend source change.
6. Stop Compose even after a failed check, without deleting volumes. Test fixtures own their
   application processes and per-run schemas; failures stay visible in the job log.

Docs-only changes can select no applications. The summary explains that no application
tests ran; format, root-tool and schema checks still run. This is not evidence of product
behavior. Shared configuration/workflow/ignore changes intentionally select all four apps;
the PR still uses affected targets and never calls test:full.

When changing CI, validate both YAML/expressions and shell steps using actionlint (with
ShellCheck available), and check real input impact without executing broad test suites:

```bash
actionlint .github/workflows/affected.yml .github/workflows/full-regression.yml
npm run projects -- --affected --files=apps/admin/src/features/products/product-form.tsx
npm run projects -- --affected --files=apps/products/src/products/products.graphql
npm run projects -- --affected --files=apps/products/prisma/migrations/20260922000000_init/migration.sql
npm run projects -- --affected --files=compose.yaml
npm run projects -- --affected --files=.github/workflows/affected.yml
npm run projects -- --affected --files=docs/testing.md
npm run test:affected -- --files=apps/admin/src/features/products/product-form.tsx product-form.test.tsx --skip-nx-cache
```

Expected application sets are admin; all four; products/gateway/admin; all four; all four;
none, respectively. These explicit-file examples inspect the configured graph; actual
PR execution uses the event SHAs instead. Verify the history step with an available commit
and missing/invalid references; never treat a refused comparison as passing coverage.
actionlint is an external contributor tool, not an application dependency. A local syntax
or shell check does not prove that checkout, npm ci or browser installation works on GitHub.

## Full regression

`npm run test:full` explicitly runs schema tests, the configured test/test-db project targets
and the Chromium smoke target. It is
reserved for a user/reviewer request and must never be invoked automatically during
implementation. It requires test databases and Chromium.
[Full regression (manual)](../.github/workflows/full-regression.yml) has workflow_dispatch
as its only trigger. In GitHub Actions, choose that workflow, Run workflow and the desired
branch. Manual dispatch requires the workflow on the default branch; see
[GitHub's manual-run guide](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow).
It installs prerequisites, runs format/schema/lint/typecheck/build and then test:full.
Do not equate a configured workflow with an executed acceptance run.
