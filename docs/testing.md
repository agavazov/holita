# Focused validation

## Select the narrowest relevant target

Use named root npm targets with native runner selectors. Jest handles backend tests;
Angular CLI uses Vitest/jsdom; Playwright handles compiled-app browser checks. Admin stories run
in Vitest with Chromium ([story tests](#storybook-story-tests)), and Playwright captures them for
[visual review](#storybook-visual-review). Commands are non-watch. `npm test` is not the
validation interface.

```bash
npm run test:fleet -- vehicles.service.spec.ts --skip-nx-cache
npm run test:fleet -- devices.service.spec.ts --testNamePattern="rejects" --skip-nx-cache
npm run test:core -- health.spec.ts --skip-nx-cache
npm run test:gateway -- router.runtime.spec.mts
npm run test:karma-client -- cars.spec.ts --skip-nx-cache
npm run test:admin -- --include=app/features/fleet/vehicles/vehicles-api.spec.ts --skip-nx-cache
npm run test:admin -- --include="app/theme/**/*.spec.ts" --include="app/ui/**/*.spec.ts" --skip-nx-cache
```

Without a file, each named target selects its own current unit/bootstrap suite. Admin `--include`
paths are relative to `apps/admin/src`, accept globs and may repeat. Gateway bootstrap checks run the installed native Router with unavailable subgraphs, without a
database, and verify health, a local GraphQL query, unknown routes and oversized headers.
DB targets are separate and noncached. Do not accept zero executed tests, enable
`--passWithNoTests` or use watch mode. Read actual counts; mocks are not persistence proof.
Root tooling changes require `npm run lint`, `npm run typecheck` and `npm run build` plus
relevant behavioral checks. SDL/operations also require codegen, schema:check and test:schema.
The existing `test:schema` runner also includes the offline eData extraction tools;
select them with `npm run test:schema -- catalog.unit.spec.mts`.

Admin unit specs run in jsdom with the `matchMedia`, `ResizeObserver` and `scrollIntoView` stubs
of `src/test-setup.ts` ([breakpoints](admin-design-system.md#global-styles-layers-and-breakpoints)).
The longer login, Branch and language transition cases declare their own deadlines. Rerun a
timed-out case with its native file selector before treating it as a regression. Run heavy Nx, Angular and Storybook
checks (builds, `test:admin`, `test:storybook:admin`, `test:visual:admin`, browser smokes) one at a
time in a worktree: each first runs the admin `graphql-generate` target, which rewrites
`apps/admin/src/generated/graphql`, and parallel runs collide.

## Domain checks

[Discocan checks](discocan/testing.md) cover Fleet Vehicles, Devices, Drivers, Vehicle groups,
General settings/preferences, telemetry, trips, alerts, service tasks and the list contract, Angular workspaces,
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
After Router health, federation provisioning obtains one synthetic demo session and polls bounded
signed Core Branch and scoped Fleet list/summary reads for up to ten seconds. Positive counts are
valid readiness results. Browser fixtures reuse that verified session and readiness result.
Each native subgraph has a 30-second startup readiness budget from process spawn, including
module loading before Nest logs appear. Health probes take at most one second, capped by
that remaining budget. A process exit ends startup polling.
No fixture starts a JavaScript Gateway or selects another runtime.

Angular fixtures serve the compiled production app from `apps/admin/dist/browser` and answer
`/config.json` with their own runtime configuration; every other path comes from the build.
The production build excludes `config.local.json`, so the application's request for
`/config.local.json` receives 404. Smokes run without a PrimeUI key and show the "Invalid PrimeUI
License" notice ([admin Storybook](development.md#admin-storybook)).
They own dedicated backend processes/schemas.
Browser fixtures create their own business records without running Fleet sample seeds. The Isolation tenant/branch exists only in these test fixtures.
The app fixture has an independent 120-second provisioning budget for isolated schemas and native
backend processes. Browser scenarios retain their 60-second timeout and 10-second expectations.
Shared federation readiness proves GraphQL and Prisma availability before business mutations run.
Only idempotent readiness reads are polled; mutations are never retried.
Router's 5-second and Fleet's Core-client 3-second production deadlines remain unchanged.
Browser targets build the admin and three subgraphs, prepare Router, use Chromium, disable retries and retain
failure traces under ignored test-results. Screenshots are opt-in with the exported
`HOLITA_BROWSER_SCREENSHOTS=1` for browser-fixture captures and failure/trace images across all
Angular smoke suites; the default retains DOM and ARIA diagnostics. The separate Storybook
visual target produces review candidates.
Clean up task-started connections/processes.

The shared Branch, language, theme and Sign out helpers operate the topbar menus in signed-in
smokes. Menu activation waits for the owning popup to close; a theme command changes its item
label before the leave animation finishes, so the old label disappearing is insufficient.
Vehicles checks exercise the real list and routed drawer,
rich field persistence/null clearing, filter/sort URL state, batch partial results, dirty drafts,
scope isolation, themes and narrow widths. Devices checks cover stock, metadata, assignment and
clearing. `angular-fleet.smoke.spec.mts` covers Overview retry/null data, Groups and Drivers CRUD,
scorecards, Vehicle profile/odometer, Maintenance completion/history and empty Trips/Alerts.
The shell checks include menu keyboard order and the explicitly unavailable Demo notification bell.
The login page keeps its Tenant/Branch comboboxes, language link and theme button.

## Storybook story tests

```bash
npm run test:storybook:admin
```

The uncached `admin:test-storybook` target runs `vitest run --config .storybook/vitest.config.mts`
in `apps/admin` after `graphql-generate`; no Storybook server or static build is needed.
The target forwards native Vitest selectors through npm's argument separator:

```bash
npm run test:storybook:admin -- --testNamePattern="Case name" --testTimeout=30000
```

The timeout option allows a cold browser start on slower hosts; it does not change the play
function's explicit waits. Omit `--testNamePattern` to run every story with that timeout.

`@storybook/addon-vitest` turns every story of the [admin Storybook](development.md#admin-storybook)
into a test in headless Chromium (`@vitest/browser-playwright`), one file at a time. Each test
renders the story, runs its `play` function and then axe. `a11y.test: 'error'` in
`.storybook/preview.ts` turns every violation into a failure; only the PrimeUI license notice
(`#p-license-host`) is excluded. Fix a violation in the token, component or story markup; never
lower the level or exclude more elements. Axe runs after `play`, so a play function waits
(`waitFor`) for asynchronously rendered content before it ends.

The target needs Playwright's Chromium: `npm exec -- playwright install chromium` (add
`--with-deps` on a fresh Linux host). `ng test` ignores this Vitest configuration, so
`test:admin` runs no stories; `src/storybook/graphql-fixtures.spec.ts` is an ordinary admin unit
spec. Story tests answer GraphQL from fixtures, so they do not prove backend contracts or the
compiled application; the browser smoke checks cover those.

Under WSL a run can fail a whole story file with "Failed to fetch dynamically imported module".
That is Vite failing to load the file in the browser, not a story failure; the file passes on a
rerun. Treat only a failure that repeats as a story failure.

## Storybook visual review

```bash
npm run test:visual:admin
```

The target builds the static [admin Storybook](development.md#admin-storybook), then runs
Playwright with [storybook-visual.config.mts](../tools/browser/storybook-visual.config.mts). The
spec serves `apps/admin/storybook-static` itself on an ephemeral loopback port, so no Storybook
server is needed. It captures the stories listed in
[storybook-visual.spec.mts](../tools/browser/storybook-visual.spec.mts): the introduction,
connected Fleet/settings and Karma views, device configuration states, example pages,
foundations, patterns, confirmations, operation toasts, PrimeNG coverage and the shell.
It uses Chromium, `bg-BG`, `Europe/Sofia`, a fixed clock (`2026-10-18T07:00:00Z`), device scale 1 and one worker.
Each capture waits until no fixture request has been in flight for 400 ms and the preview marks
the story's play function complete. Fixture quiet alone can precede lazy route loading.

- Every run writes reviewable candidates to the ignored `test-results/storybook-visual-candidates/`
  and attaches them to the HTML report in `playwright-report/storybook-visual/`
  (`npm exec -- playwright show-report playwright-report/storybook-visual`). Mismatch diffs are in
  `test-results/storybook-visual/`. Candidates are overwritten but never removed; delete the
  candidates directory before a run to review only the current list.
- Approved baselines are per checkout in the ignored `.references/review/storybook-baselines/`.
  Missing or changed baselines fail the run; Playwright never creates them (`updateSnapshots: 'none'`).
  A run without baselines reports "A snapshot doesn't exist": candidates exist, nothing is approved.
- Only after a person approves the candidates, record them from a fresh build:
  `npx playwright test --config tools/browser/storybook-visual.config.mts --update-snapshots=all`.
  Add `-g "<story id>"` to record only an approved subset. Never update baselines or loosen
  comparison to make the check pass.
- Captures are declared in `captures` in the spec. `bothThemes(id, sizes)` adds a light and a dark
  capture per size: `desktop` (1440×900), `tablet` (768×1024) or `mobile` (375×812); the current
  list uses desktop and mobile, and the introduction is captured in light only.
  `viewportOnly: true` captures only the viewport for stories whose drawer or dialog is fixed to
  it. Optional `brand` and `density` set those toolbar globals.
- A story ID is the title lowercased with every run of other characters replaced by `-`, then
  `--` and the export name split into words (`Examples/Fleet/Vehicles` and `Edit` give
  `examples-fleet-vehicles--edit`; `ErrorState` gives `…--error-state`). A story's `name` changes
  only its label. Files are named `<id>--<theme>[--<brand>][--<density>]--<viewport>.png`, both
  as candidates and as baselines. Test titles start with the story ID, so
  `npm run test:visual:admin -- -g "examples-fleet-vehicles"` selects captures.
- The static build excludes `apps/admin/public/config.local.json`
  ([admin Storybook](development.md#admin-storybook)), so captures always show the "Invalid
  PrimeUI License" notice, regardless of whether a developer has a local key. Keep the notice
  visible in approved baselines. Arguments to `npm run test:visual:admin` go to Playwright, not
  Nx.
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
| Vehicle validation/query/persistence    | vehicles.service.spec.ts, vehicles.db.spec.ts, vehicles-list.db.spec.ts                                                                                                                                                                                                                |
| Device IMEI/assignment/persistence      | devices.service.spec.ts, devices.db.spec.ts                                                                                                                                                                                                                                            |
| Driver/Vehicle group rules/persistence  | drivers.service.spec.ts, drivers.db.spec.ts, vehicle-groups.service.spec.ts, vehicle-groups.db.spec.ts                                                                                                                                                                                 |
| Fleet list contract/validation/scalars  | validation.spec.ts, scalars.spec.ts and the affected module's service and db specs                                                                                                                                                                                                     |
| Fleet telemetry/trips/alerts/service    | sql.spec.ts, vehicle-state.spec.ts, the owning telemetry/trips/events/service-tasks/overview service and DB specs, drivers-list.db.spec.ts and federation.db.spec.mts                                                                                                                  |
| Fleet migration/CHECKs/unique mapping   | initial-migration.db.spec.ts, branch-migration.db.spec.ts, constraints.db.spec.ts, seeds.db.spec.ts; rich seed uses demo-seed.unit.spec.ts and demo-seeds.db.spec.ts                                                                                                                   |
| Fleet business errors through Router    | router.smoke.spec.mts (`npm run test:gateway:router`), federation.db.spec.mts                                                                                                                                                                                                          |
| Runtime module/health                   | Fleet/Core health.spec.ts; Gateway router.runtime.spec.mts                                                                                                                                                                                                                             |
| Karma account client/access             | accounts.spec.ts, history.spec.ts, location.spec.ts, edata.spec.ts, edata.service.spec.ts, cars.spec.ts, cars.service.spec.ts, Karma health.spec.ts                                                                                                                                    |
| Karma truck/reference reads and routing | accounts.spec.ts, history.spec.ts, location-references.spec.ts, karma-workspace.spec.ts, edata-page.spec.ts, angular-karma-phase4.smoke.spec.mts, angular-karma-phase3.smoke.spec.mts, angular-karma-phase2.smoke.spec.mts, angular-karma.smoke.spec.mts, angular-edata.smoke.spec.mts |
| SDL/operations                          | codegen, schema:check, contracts.unit.spec.mts                                                                                                                                                                                                                                         |
| Cross-service contracts/context         | federation.db.spec.mts                                                                                                                                                                                                                                                                 |
| Branch/language/default routing         | branch-context.spec.ts, fleet-workspace.spec.ts, angular-foundation.smoke.spec.mts                                                                                                                                                                                                     |
| General settings/preferences/units      | settings/general-settings-api.spec.ts, general-settings-mapping.spec.ts, general-settings-page.spec.ts, general-settings-view.spec.ts, fleet-preferences.spec.ts; ui/format/fleet-format.spec.ts, workspace/Branch routing specs and angular-settings.smoke.spec.mts                   |
| Captured feature clients/forms/deletion | the owning Fleet API/query/editor/page specs; Vehicle profile and odometer use vehicle-profile.spec.ts; every connected feature has catalog parity checks                                                                                                                              |
| Scoped relation choices/cancellation    | device-choices.ts behavior in device-editor-page.spec.ts, VehicleChoices and MaintenanceChoices specs; scoped reads retire with their editor clients                                                                                                                                   |
| Admin theme/tokens/global styles        | app/theme specs, test:storybook:admin, test:visual:admin with candidate review                                                                                                                                                                                                         |
| Admin app/ui patterns                   | the pattern's app/ui spec, test:storybook:admin, test:visual:admin with candidate review                                                                                                                                                                                               |
| Shell/topbar menus/mobile/keyboard      | app/layout, app/workspace and app/i18n specs, test:storybook:admin, test:visual:admin with candidate review; angular-shell.smoke.spec.mts covers topbar menus, Demo bell, geometry, drawer, focus and theme                                                                            |
| Real CRUD and narrow views              | angular-vehicles.smoke.spec.mts, angular-devices.smoke.spec.mts, angular-fleet.smoke.spec.mts                                                                                                                                                                                          |
| Admin stories/fixtures/example pages    | admin typecheck and lint, test:storybook:admin, graphql-fixtures.spec.ts for fixture changes, test:visual:admin with candidate review                                                                                                                                                  |
| Root tooling                            | root lint/typecheck/build and relevant behavior                                                                                                                                                                                                                                        |

Admin specs are selected with `npm run test:admin -- --include=...` as above;
[changing the design centrally](admin-design-system.md#changing-the-design-centrally) lists the
combined checks for a central design change.

`fleet-record-links.spec.ts` and the concrete Driver/profile/Device/Trip/Alert specs check scoped
native anchor targets and the bounded Driver return marker. The Fleet browser smoke follows
Driver → Vehicle → edit → Driver through the compiled routes; Device and Karma smoke cases
verify that identity/actions stay in the table viewport after horizontal scrolling at 375px.
Karma record-detail stories and eData/history specs check collapsed source fields, preserved
null/zero values, escaped source text and focus restoration. Their visual candidates cover
desktop/mobile and both themes; the responsive-table pattern also varies brand and density.

Run `npm run test:smoke:admin -- angular-settings.smoke.spec.mts` for the compiled settings flow.
General settings cases explicitly flush `AdminFleetPreferences` before business operations;
they cover read gating/Retry, Branch/language/session isolation, saved-unit propagation and
the separate Fleet-save/Core-rename outcomes. A failed rename must retain its name draft and
the actual persisted Fleet baseline, without a false full-success toast. Disabled Demo
notification switches never become a persistence/delivery assertion. Read-value conversion
preserves null/zero. Numeric API filters and editors explicitly labelled in km use canonical
units; the odometer editor uses the Branch display unit and converts submissions back to km. The
`admin-settings-general--default` capture covers both themes at desktop/mobile widths;
its candidates require human baseline approval.

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

PR CI does not build Storybook or run `test:storybook:admin` or `test:visual:admin`. Story tests
run locally and in [full regression](#full-regression); visual baselines exist only in local
checkouts.

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

`npm run test:full` explicitly runs schema tests, the configured test/test-db/test-router project targets,
the Angular Chromium smoke target and the Storybook story tests (`test:storybook:admin`), in that
order, and stops at the first failing step. It is reserved for a user/reviewer request and must never be invoked automatically during
implementation. It requires the pinned Router binary, test databases and Chromium. It does not
run the visual review.
[Full regression (manual)](../.github/workflows/full-regression.yml) has workflow_dispatch
as its only trigger. In GitHub Actions, choose that workflow, Run workflow and the desired
branch. Manual dispatch requires the workflow on the default branch; see
[GitHub's manual-run guide](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow).
It installs dependencies and Router, runs format/schema/lint/typecheck/build and then test:full.
Do not equate a configured workflow with an executed acceptance run.
