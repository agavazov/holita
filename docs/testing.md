# Focused validation

## Select the narrowest relevant target

Backend tests use Jest/ts-jest in ESM mode; Node's experimental VM modules flag is supplied
by the application script. Angular uses the CLI's native unit-test builder with Vitest/jsdom.
Commands are non-watch. There is no root `test` script or custom selector dispatcher.

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

Without a file, `test:core`, `test:products`, `test:gateway`, `test:reference`, `test:admin` intentionally
select only that application's current unit/bootstrap suite. Database suites have
separate named targets; browser tests use test:smoke:admin. No selector must silently fall back to every project, and
`--passWithNoTests` must not be enabled. A missing file or a case pattern that executes
zero tests is not successful validation, even if a runner exits zero for skipped cases.

## Vehicles checks

Use `npm run test:reference -- vehicles.service.spec.ts --skip-nx-cache` for input validation,
creation-only store checks and scoped repository calls. After the database prerequisites below,
run `npm run test:reference:db -- vehicles.db.spec.ts` for actual migrations, two-field CRUD,
nullable Notes, foreign-ID/federation isolation and literal plate search/paging.

`npm run test:admin -- --include="app/features/reference/vehicles/*.spec.ts" --include=app/features/reference/reference-workspace.spec.ts --skip-nx-cache`
checks typed forms, URL mapping, per-client scope, A → B → A, delayed mutations, confirmation
retirement and partial deletion retry.
`npm run test:smoke:admin -- angular-vehicles.smoke.spec.mts` checks compiled Angular CRUD, Notes clearing/reload, store isolation and Bulgarian 1280/390/320px light/dark
forms/lists with long Notes. Captures remain in ignored `.references/review/vehicles`.

## Angular admin checks

Use Angular CLI's native `--include` path relative to `apps/admin/src`, and `--filter` for
case selection. Files use `.spec.ts`; use `--filter` rather than the backend runner's
`--testNamePattern` option.

```bash
npm run test:admin -- --include=app/core/config/admin-config.spec.ts --skip-nx-cache
npm run test:admin -- --include=app/layout/appearance.spec.ts --skip-nx-cache
npm run test:admin -- --include=app/core/graphql/graphql-options.spec.ts --skip-nx-cache
npm run test:admin -- --include=app/features/products/products-api.spec.ts --skip-nx-cache
npm run test:admin -- --include=app/features/products/products-page.spec.ts --skip-nx-cache
npm run test:admin -- --include=app/features/products/product-editor.spec.ts --skip-nx-cache
npm run test:admin -- --include=app/features/products/products-deletion.spec.ts --skip-nx-cache
npm run test:admin -- --include=app/features/products/products-api.spec.ts --filter="submitted mutation" --skip-nx-cache
npm run test:admin -- --include=app/features/stores/store-workspace.spec.ts --skip-nx-cache
npm run test:admin -- --include=app/features/reference/reference-workspace.spec.ts --skip-nx-cache
npm run test:admin -- --include="app/features/reference/venues/*.spec.ts" --skip-nx-cache
npm run test:admin -- --include="app/features/reference/speakers/*.spec.ts" --skip-nx-cache
npm run test:admin -- --include="app/features/reference/tags/*.spec.ts" --skip-nx-cache
npm run test:admin -- --include=app/features/reference/media/media-api.spec.ts --skip-nx-cache
```

On CPU-constrained hosts, prefix a selected command with `VITEST_MAX_WORKERS=2` to bound
Vitest workers without changing case selection or test deadlines.

These execute generated documents through real Apollo Angular/HttpLink with Angular's
HTTP testing controller. Products tests cover separate clients/query deduplication/entity
caches, captured headers, late mutation success/failure, shutdown after the last pending write,
initial error/retry/empty DOM states and retained rows after refresh failure. Transport diagnostics
cover concurrent network/HTTP failures, Gateway response IDs, GraphQL errors and the actual
10-second HTTP deadline using fake timers. Routing uses
RouterTestingHarness and the actual lazy routes to prove A → B → A recreation, cancellation
of an obsolete read, language-scoped client recreation, obsolete Stores refresh rejection and
unavailable/empty store handling. Config tests validate the public
endpoint, optional license configuration and boolean Reference availability. Appearance tests verify restored preferences
and usable theme switching when storage is denied. Controlled HTTP is not proof of backend persistence.

The Products page suite uses the actual routes, PrimeNG controls and Apollo transport to
check bookmarked/unknown totals, URL normalization, GraphQL Int and Unicode limits, correction
of unavailable pages after the network total arrives, stale cached totals, clearing drafts
without a URL change, combined filter commits, debounce cancellation,
restored URL drafts, empty filtered results, obsolete refresh rejection and controlled sorting
without duplicate requests. Same-query refresh errors remain covered by the API suite.

The editor suite uses actual routes, Reactive Forms, PrimeNG confirmation controls and Apollo
HTTP requests. It covers defaults, trimming, Unicode/NUL boundaries, first-invalid-field focus,
initial detail retry, duplicate submit suppression, failed writes preserving fields/request IDs,
invalid/missing records, same-store ID guards, rejected store/language navigation, selector
restoration and beforeunload. Pending reads are canceled on editor changes. Late create success/
failure and update success after mode/ID/store/language changes leave the current editor unchanged.
Later detail notifications cannot rehydrate dirty fields.
Products, lookup and Event editor cases interleave a rejected write with an earlier read,
retain its diagnostics, then recover a failed detail read through the rendered Retry button
without replacing dirty fields. Session read recovery covers both parent and child failures.

The deletion suite uses actual routes, PrimeNG controls and Apollo HTTP requests. It covers
canceling confirmation without a mutation, page-local selection/reset/pruning, duplicate-delete
suppression, sequential partial results, failed-row retry, authoritative last-page correction and
retaining confirmed deletions after a failed refetch. Delayed success after store/language/query/
editor navigation and delayed failure after a store change cannot affect the new view or submit
the remaining targets. Spies observe the real submitted promises and Apollo client stop; retired
clients stop after settlement, while same-workspace query changes retain their client.

Reference boundary cases exercise disabled list/create/edit routes without business requests,
unknown stores and section-preserving A → B → A selection for Venues, Speakers, Tags and Events. API/page/editor/deletion
suites use actual routes, PrimeNG controls and Apollo HTTP: client/header isolation and retired
writes, server paging, false activity filters, URL/debounce/sorting, Unicode/country/capacity
validation, nullable input mapping, dirty guards, first-invalid and server-field focus, retained
drafts and late callbacks. Validation cases reject malformed/unknown server field errors.
Session editor cases cover independent parent/child loading and errors during concurrent
retries, and preserving a rejected write after earlier reads finish. Gallery component cases
cover background recovery without clearing action errors and explicit refresh recovery.
Speaker Email cases match Validator's accepted quoted addresses and reject consecutive dots.
Relation picker cases cover Unicode/NUL search bounds and selected-label retry without
requesting hidden choices, plus canceling pending search when closing so reopening does
not reset a newly selected page. Event URL cases retain a valid capacity maximum when the
minimum is invalid.
Sequential deletion cases preserve successes, retry failures, correct the last page and stop
unsent writes on store/language/query/editor navigation. Controlled HTTP is not backend evidence.

For the compiled application and real gateway:

```bash
npm exec -- playwright install --with-deps chromium
npm run db:up
npm run db:setup
npm run db:test:setup
npm run test:smoke:admin -- angular-foundation.smoke.spec.mts
npm run test:smoke:admin -- angular-shell.smoke.spec.mts
npm run test:smoke:admin -- angular-products-list.smoke.spec.mts
npm run test:smoke:admin -- angular-product-editor.smoke.spec.mts
npm run test:smoke:admin -- angular-products-delete.smoke.spec.mts
npm run test:smoke:admin -- angular-venues.smoke.spec.mts
npm run test:smoke:admin -- angular-lookups.smoke.spec.mts
npm run test:smoke:admin -- angular-events.smoke.spec.mts
npm run test:smoke:admin -- angular-lifecycle.smoke.spec.mts
npm run test:smoke:admin -- angular-sessions.smoke.spec.mts
npm run test:smoke:admin -- angular-media.smoke.spec.mts
```

`admin:test-smoke` is noncached and builds Angular plus the four backends. Its
[fixture](../tools/browser/angular-fixture.mts) serves `apps/admin/dist/browser` with SPA
fallback and a runtime config pointing to its gateway. It reuses the guarded federation
fixture for dedicated per-run database schemas and real backend processes. Its `referenceEnabled`
option configures both fixture UI startup and backend availability (defaults to true). Cleanup closes
those schemas, servers and connections. No development data is used.

The foundation browser cases verify discovery, real store-scoped Products, A → B → A,
route reload, Bulgarian navigation, a delayed real A response after switching to B and a
new language-scoped request while the old language response is still pending.
Products list cases create their records through the real Gateway inside the fixture's test
schemas. They verify combined filters and sorting across server pages, bookmarked page reload,
Back/Forward with an uncommitted draft, page-size changes, clearing filters while preserving
sort/size/foreign query/hash, delayed filtered response isolation and Bulgarian controls at
320px in both themes. Only delivery of the old response is delayed; persistence and reads
execute through the actual backends.
Venues browser cases verify real create/update/reload and optional nulls, country/activity,
server filters/history, nullable capacity ordering and descending ID ties. They also exercise
actual referenced-deletion failures followed by partial retry, last-page correction, a delayed
Reference module after replaced navigation, A → B → A reads and captured writes, stopping
unsent deletes, dirty navigation and disabled
Reference with usable Products/mobile navigation. Bulgarian lists/editors are captured at
1280/390/320px in both themes with overflow and runtime-error assertions. These exercise the
existing backend. Lookup browser cases add Speaker nullable Email/biography persistence, Email
null-last sorting and Tag HEX normalization/live preview, Color sorting, focused duplicate Name
errors, referenced deletion through trashed Events and failed-row retry. They also exercise
A → B → A delayed reads/writes, dirty navigation, disabled routes and Bulgarian narrow light/dark
controls. Event browser cases verify every field and generated create/update mapping,
exact EUR budgets, nullable clearing, immutable Code, reload/overview HTML, remote Venue paging,
selected inactive Venue/Tag hydration, server ranges/filters/sorts, Back/Forward and per-store
columns. They exercise DST gaps, UTF-8 limits, paste cleanup, formatting/link/undo/redo,
pending read-only rich text, A → B → A reads/writes and dirty/disabled routes. BG list/editor/
overview and open lookup are captured at 1280/390/320px in light/dark with overflow/runtime checks.
Lifecycle browser cases in `angular-lifecycle.smoke.spec.mts` exercise confirmed atomic
status/Trash/Restore with whole-batch rejection and retained retry, foreign/missing IDs,
reserved Code and child preservation, read-only Trash, empty/paginated History and HTML
excerpts, delayed duplicate bulk confirmation and query/store retirement. Bulgarian lifecycle
selection/dialog/expanded History use matched desktop/narrow viewports in light/dark.
Session helpers, captured API/program and editor cases use
`npm run test:admin -- --include="app/features/reference/sessions/*.spec.ts" --skip-nx-cache`.
They check parent bounds, DST/exact instants, Unicode text/100 Speaker limits, nullable inputs,
retained order conflicts/reloading, read cancellation, captured writes and server-field focus.
`angular-sessions.smoke.spec.mts` exercises real child CRUD/relations, Event date protection,
plain Summary, drag/buttons/complete-set order retry, dirty tabs, remote Speaker paging/inactive
hydration, History, Trash/Restore and parent/editor/store retirement. Its BG program/editor/
Speaker overlay/summary captures use matching 1280/390/320px light/dark viewports with overflow
and runtime checks. Gallery controlled HTTP cases in `media/media-api.spec.ts` cover
client/read retirement, copied complete-order IDs, capability-only bytes/progress/cancellation,
late intent/finalization, Unicode Alt text/null clearing and failed-draft retention.
`angular-media.smoke.spec.mts` verifies real bytes surviving reload, independent Event drafts,
Alt text/cover/removal/History, native drag/keyboard order and complete-membership conflict,
invalid files/decoder failures/ten-image limit, unfinished transfer cancellation, captured
store/Event finalization, broken previews, Trash/Restore and disabled routes without Media
operations. Its Gallery/progress/order/
metadata/delete/preview captures use 1280/390/320px light/dark with overflow/runtime checks.
Reference's exact origin parsing/legacy fallback is selected with
`npm run test:reference -- admin-origins.spec.ts`; the real browser fixture explicitly supplies
its ephemeral origin in `ADMIN_ORIGINS`.

Event unit selection uses `--include="app/features/reference/events/*.spec.ts"` plus
`--include=app/features/reference/relation-picker.spec.ts` and the Reference boundary suite.
Form helpers verify winter/summer/gap/repeated-hour instants, retained milliseconds, decimal
strings, UTF-8 limits and safe HTML; controlled Apollo/editor cases prove retired writes,
read cancellation, field focus and dirty navigation. Manually controlled defer cases verify
that the rich editor receives an existing local draft and disabled state when loaded, and
that a rejected description receives focus after delayed editor loading.
`event-overview.spec.ts` retains the mounted program and an unsaved Session order through
a failed parent refresh and recovery, without issuing an order mutation or reloading the
child list. History cases cover text excerpts,
page/revision retirement and retry. Event route tests stub jsdom's missing ResizeObserver
and Range geometry/scrolling;
real Tabs geometry and keyboard behavior are checked in Chromium. Use `VITEST_MAX_WORKERS=1` for combined
Angular selections on this host; runner selectors and deadlines remain native.

The shared store-selection helper waits for the Select panel to detach after closing before
another selection; it asserts expanded/collapsed state without fixed sleeps or forced clicks.
Only response delivery is delayed; the backend query executes normally. Traces/screenshots
on failure go to ignored `test-results/angular-browser`. Shell cases verify active navigation,
desktop collapse with hidden links excluded from keyboard/accessibility navigation, header
keyboard order/focus in both themes, theme persistence, language path/query/hash preservation,
active Stores navigation with query/fragment values, keyboard store selection,
mobile focus trapping/dismissal and closing the drawer on navigation/desktop resize. They verify
visible keyboard outlines in both themes and the actual Drawer width at a 320px viewport.
Responsive cases check header keyboard order, 28px gutters/content spacing at 320/390/768/991px,
one mounted store selector, open-overlay cleanup at 991 → 992px and preservation of a dirty
editor draft and selected store through resizing. Drawer dismissal on that same breakpoint
restores toggle focus and releases scroll blocking.
Desktop checks also verify the 14px scale, 56px top bar, 280px sidebar, locally loaded
Lato and centered 1504px content at a 2560px viewport.
Shell screenshots at 1280×800, 390×844 and 320×800 are also written there for light/dark visual
review, including the collapsed desktop layout and a tablet editor capture. Tests do not configure
a license key or suppress PrimeNG's license banner. Compare layout captures with the actual
Sakai source at matching viewport sizes; screenshots alone do not prove interaction behavior.
Use the [source preview instructions](development.md#sakai-source-reference) for the shell,
CRUD and form examples. Compare desktop/mobile, light/dark, collapsed navigation and open
overlays. Review control typography, card/heading spacing, themed business links, mobile
navigation and the holita footer separately from the assertions above. Preserve the
documented adaptations: the mobile store-selector row, the native Drawer header/close
control and holita branding. Sakai owns visual composition; concrete Angular features
supply contracts and lifecycle behavior. Temporary source comparisons belong in ignored
`.references/review/`; product documentation does not depend on those captures.
Mutation retirement is covered by
the controlled-HTTP tests and editor browser cases. Editor cases exercise real create/update
persistence, reload, SKU conflicts, query/hash return, dirty store/language/history guards,
Escape/focus, malformed IDs and cross-store detail rejection. Delayed real success/conflict
responses verify callback isolation across store/same-store editor navigation. The Bulgarian
create workflow runs at 320px in both themes; desktop/mobile editor captures use the same
ignored output directory. Deletion cases verify single confirmation, keyboard cancellation/focus
return, page-local select-all, persistence through reload, final-page correction and retained
query/hash. A record removed through a competing real Gateway mutation creates a genuine
NOT_FOUND partial failure; a controlled transport abort before submission verifies retrying only
the failed record. A delayed real delete response proves store isolation and stopping the unsent
remainder. Bulgarian confirmation runs at 320px with a long product name in both themes;
the same case checks error-message wrapping after a transport failure and successful failed-row retry.
desktop partial-result and mobile confirmation captures use the same ignored output directory.
No test invents a bulk backend API. Gallery coverage is documented in the Angular Reference
checks above, including persisted uploads.
These checks use Chromium, without automatic retries, and do not establish GitHub execution.

For a combined presentation and startup review, use:

```bash
npm run test:smoke:admin -- angular-parity.smoke.spec.mts
```

It checks populated lists, retained editor drafts and invalid-ID feedback through the Gateway,
Bulgarian/English and light/dark, at 1280, 992, 991, 390 and 320px. Review its captures
against the pinned Sakai source; overflow/font/padding assertions do not establish visual
fidelity alone. Cases use the dedicated database fixture. Startup cases reject configuration
before bootstrap and verify a localized alert and matching document language.
The long-label case saves valid unbroken Event/Tag labels and checks the overview and
Session editor in both themes at desktop, 992px and 320px.

## Real PostgreSQL checks

```bash
npm run db:up
npm run db:setup
npm run db:test:setup
npm run test:core -- test-database-url.unit.spec.ts
npm run test:core:db -- persistence.db.spec.ts
npm run test:products:db -- persistence.db.spec.ts --testNamePattern="rejects duplicate SKU"
```

Normal test targets do not connect to a database. `test:core:db`, `test:products:db` and `test:reference:db`
use Jest's separate jest.db.config.mjs and select test/**/*.db.spec.ts. Each run guards
the local test URL, creates a random schema in its dedicated test database, runs the
actual checked-in migrations, and passes that schema to its service's Prisma adapter.
Cleanup disconnects the client and drops only the schema created by that run.
Tests never use development URLs, a public schema reset, shared truncation, or mocked
Prisma as evidence of persistence correctness. The permission cases expect both dev/test
databases to have been provisioned, but do not need development migrations or seeds.

URLs must use the exact service test database and role, a loopback host, a password and
no URL options. CORE_TEST_DATABASE_URL, PRODUCTS_TEST_DATABASE_URL and REFERENCE_TEST_DATABASE_URL configure them;
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
pagination, sorting in both directions with stable ties, invalid sort inputs, missing/malformed
context, foreign IDs, entity representations and masked errors.
Unicode boundary values are persisted and NUL input is rejected without writes.

Gateway's noncached DB target builds the four backends and runs the fixture in
tools/graphql/federation.db.spec.mts. It migrates/seeds new schemas using dedicated test
roles, starts actual compiled Node applications on ephemeral ports, and observes HTTP
headers through forwarding test servers. No business service or Prisma client is mocked.
It verifies both stores, CRUD/scoping, Product-to-Store federation, concurrent contexts,
creation validation reuse and behavior with the actual core process stopped. Cleanup
stops only its own processes and drops only its own schemas. This is a focused backend
integration target, not a browser/UI or full regression test.

`npm run test:schema -- contracts.unit.spec.mts` checks real composition/operations and
negative changes offline. Its Jest module discovery excludes ignored temporary and source-reference
directories. The separate federation-guard.unit.spec.mts file tests the
whole-graph fixture's URL guards without opening databases.

The Nx `test-db` target has cache:false; any displayed cache hit belongs to generation,
not the live database test. Native file and --testNamePattern selection works unchanged.
These targets are included in test:affected and the manually requested test:full command.
Prepare databases before an affected run that includes them. If a process is forcibly
killed, a test schema may remain; investigate that specific schema instead of deleting
all test schemas, which could belong to another active run.

## Reference checks

Reference uses dedicated-database guards and per-run schema cleanup. Provision databases
with `db:up`, `db:setup` and `db:test:setup`; tests never use development data or media.

```bash
npm run test:reference -- health.spec.ts
npm run test:reference -- venues.service.spec.ts speakers.service.spec.ts tags.service.spec.ts events.service.spec.ts description-html.spec.ts admin-origins.spec.ts test-database-url.unit.spec.ts
npm run test:reference:db -- persistence.db.spec.ts venues.db.spec.ts events.db.spec.ts lifecycle.db.spec.ts sessions.db.spec.ts media.db.spec.ts
npm run test:gateway:db -- federation.db.spec.mts
npm run test:admin -- --include="app/features/reference/**/*.spec.ts" --skip-nx-cache
npm run test:smoke:admin -- angular-venues.smoke.spec.mts angular-lookups.smoke.spec.mts
npm run test:smoke:admin -- angular-events.smoke.spec.mts angular-lifecycle.smoke.spec.mts
npm run test:smoke:admin -- angular-sessions.smoke.spec.mts angular-media.smoke.spec.mts
```

Service suites verify validation and no-write decisions with controlled dependencies.
Persistence/HTTP suites cover actual scoped CRUD, nullable updates, stable/null-last sorting,
Unicode/NUL rules, literal search, relations/foreign keys and repeatable seeds. Events adds
exact money/Sofia date round trips, format/location rules, omitted/null inputs and sanitized
HTML. Lifecycle cases cover explicit Trash, reserved Codes, 1–100-ID atomic actions,
transactional History rollback, restore and pagination. Sessions cover parent bounds,
Speaker ownership/retained inactive assignments and complete-set ordering conflicts.
Media cases use owned temporary storage for real upload/read streams, Sharp decoder
validation, generated keys, capability expiry/replay, idempotent finalize, cover/Alt text/order,
interruption/orphan cleanup and preserved private bytes through Trash/Restore.

Gateway's real federation suite covers concurrent scoped headers, creation-only Core
validation, forwarded field errors, disabled Reference, lifecycle/children/media and direct
binary transfers bypassing GraphQL. Its fixture owns private media and dedicated schemas.
Angular's controlled-HTTP suites cover form/query/cache/retired callbacks; the compiled
browser cases prove the selected Real UI workflows. Component mocks do not establish backend persistence or federation parity.

## Real browser smoke checks

```bash
npm exec -- playwright install --with-deps chromium
npm run db:up
npm run db:setup
npm run db:test:setup
npm run test:smoke:admin -- angular-foundation.smoke.spec.mts
```

The noncached `admin:test-smoke` target builds the admin and four backends, then invokes
Playwright with `tools/browser/angular.config.mts`. Native file/`--grep` selection uses one
headless Chromium worker, no retries and the configured deadlines. Real cases serve the
compiled Angular app and start fixture-owned backends on ephemeral ports with fresh
migrated/seeded test schemas. Cleanup closes only those processes, connections and schemas.
Screenshots/traces use ignored `test-results/angular-browser`; Sakai comparison
captures use `.references/review/`. Chromium is the configured browser; these checks do not
establish Firefox/WebKit support or execution on GitHub.

## Current change-to-check mapping

| Change                                            | Applicable check                                                                                                                                                                                                                                                              |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Backend bootstrap or health route                 | That service's health.spec.ts, typecheck/build, and startup when main.ts changes                                                                                                                                                                                              |
| Backend PORT or shutdown handling                 | Run the affected service with a valid override and invalid PORT; verify exit and released port                                                                                                                                                                                |
| Admin build or test configuration                 | Admin typecheck/build; verify runner selection; add relevant behavioral tests when interactive code exists                                                                                                                                                                    |
| Root TypeScript/Jest/Nx/dependency configuration  | Root lint/typecheck/build and relevant explicit backend files; record that all projects may be affected                                                                                                                                                                       |
| Import boundaries                                 | ESLint on the affected source; verify a prohibited cross-application import is rejected                                                                                                                                                                                       |
| Prisma schema, client, migration or seed          | Owning service's persistence.db.spec.ts, db:validate, typecheck/build; verify repeat seed behavior                                                                                                                                                                            |
| Test URL guard or cleanup                         | Owning service's test-database-url.unit.spec.ts and persistence.db.spec.ts; simultaneous-schema case                                                                                                                                                                          |
| Compose or database provisioning                  | Repeated db:setup/db:test:setup, both persistence DB files, and compare development rows before/after db:down/up                                                                                                                                                              |
| Product service validation                        | products.service.spec.ts first; products.db.spec.ts for transport/persistence behavior                                                                                                                                                                                        |
| Product repository/store context/entity reference | products.db.spec.ts; federation.db.spec.mts for gateway and real service boundaries                                                                                                                                                                                           |
| SDL, named operations or generation               | schema:check, test:schema, codegen and affected typecheck/build; federation file for runtime contract changes                                                                                                                                                                 |
| Core client or gateway context/communication      | federation.db.spec.mts, especially validation reuse, concurrent headers and stopped core                                                                                                                                                                                      |
| Stores resolver/repository                        | stores.db.spec.ts; federation.db.spec.mts when public/federated behavior changes                                                                                                                                                                                              |
| Product form or controls                          | product-editor.spec.ts; angular-product-editor.smoke.spec.mts for submission/navigation and real persistence                                                                                                                                                                  |
| Admin GraphQL mapping or headers                  | products-api.spec.ts and feature-local API suites; schema:check/codegen for operation edits; angular-foundation.smoke.spec.mts                                                                                                                                                |
| Admin translation catalogs                        | messages catalogs, admin-config/store-workspace/editor cases and angular-parity.smoke.spec.mts for localized startup/presentation                                                                                                                                             |
| Store routes, query cache or mutation lifecycle   | products-api.spec.ts, store-workspace.spec.ts and focused angular-foundation/feature delayed-read/write browser cases                                                                                                                                                         |
| Angular data/cache/store routing                  | test:admin with products-api.spec.ts and store-workspace.spec.ts; test:smoke:admin -- angular-foundation.smoke.spec.mts for real reads/routing                                                                                                                                |
| Angular Products deletion                         | test:admin with products-deletion.spec.ts; test:smoke:admin -- angular-products-delete.smoke.spec.mts for real deletes/partial results/query correction and keyboard behavior                                                                                                 |
| Angular Reference boundary/Venues/Speakers/Tags   | test:admin with reference-workspace.spec.ts and feature-local venues/speakers/tags suites; test:smoke:admin -- angular-venues.smoke.spec.mts and angular-lookups.smoke.spec.mts for real CRUD/nullable sorting/referenced retry/scope/disabled availability and mobile themes |
| Angular Reference Events                          | test:admin with events/*.spec.ts and relation-picker.spec.ts; test:smoke:admin -- angular-events.smoke.spec.mts for fields/time/money/relations/URL/rich text; angular-lifecycle.smoke.spec.mts for atomic actions/Trash/History/scoping and BG mobile themes                 |
| Angular Reference Sessions                        | test:admin with sessions/*.spec.ts; test:smoke:admin -- angular-sessions.smoke.spec.mts for CRUD/Speakers/parent bounds, order conflicts/retry, History, Trash/Restore, retired callbacks and Sakai mobile themes                                                             |
| Angular Reference Gallery                         | test:admin with media/media-api.spec.ts; test:smoke:admin -- angular-media.smoke.spec.mts for persisted bytes, independent drafts, cancellation/retirement, cover/alt/removal/order conflict, preview renewal, Trash/Restore and Sakai mobile themes                          |
| Reference upload CORS                             | test:reference -- admin-origins.spec.ts; real upload browser fixtures with explicit ADMIN_ORIGINS                                                                                                                                                                             |
| Angular runtime endpoint/config                   | test:admin with admin-config.spec.ts; Angular build and real browser checks                                                                                                                                                                                                   |
| CI workflow, affected selection or ignore rules   | actionlint, Git-history failure checks, explicit Nx changed-file examples below, root lint/typecheck/build and a focused test through test:affected                                                                                                                           |

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
npm run projects -- --affected --files=apps/admin/src/app/features/products/products-api.ts
npm run projects -- --affected --files=apps/products/src/products/products.graphql
npm run projects -- --affected --files=apps/products/prisma/migrations/20260922000000_init/migration.sql
npm run projects -- --affected --files=compose.yaml
npm run projects -- --affected --files=.github/workflows/affected.yml
npm run projects -- --affected --files=docs/testing.md
npm run test:affected -- --files=apps/admin/src/app/features/products/products-api.ts --include=app/features/products/products-api.spec.ts --skip-nx-cache
```

Expected application sets are admin; all five; products/gateway/admin;
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
