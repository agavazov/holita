# Discocan focused checks

## Simple eData reference catalog

See the [catalog checks](erm-resources/simple-edata-catalog/README.md#focused-validation)
for EXE-only Python fixtures and the focused Fleet `edata-catalog.unit.spec.ts`,
`edata-catalog.db.spec.ts` and `initial-migration.db.spec.ts` selectors. Real PostgreSQL
checks cover the full v9.56 catalog, transactional rollback, concurrency, idempotency
and stored-row verification in dedicated test schemas.

Follow the [shared validation guide](../testing.md) for native targets, database prerequisites,
guarded fixtures, CI selection and manual full regression. These checks cover the current
Fleet implementation using Store scope; Branch contracts are not implemented.

## Vehicles checks

`npm run test:fleet -- vehicles.service.spec.ts --skip-nx-cache` checks text/null validation,
scoped repository calls and creation-only Core checks. `vehicles.db.spec.ts` checks actual scoped
CRUD, federation references, null clearing, literal search and deterministic sorting/pagination.

```bash
npm run test:admin -- --include="app/features/fleet/vehicles/*.spec.ts" --include=app/features/fleet/fleet-workspace.spec.ts --skip-nx-cache
npm run test:smoke:admin -- angular-vehicles.smoke.spec.mts
```

Angular suites cover URL query helpers, typed forms, server-field focus, client/cache isolation,
late writes, partial deletion/retry and retired confirmations. Browser checks use real CRUD,
reload/scoping and Bulgarian 1280/390/320px light/dark forms/lists. Captures belong in ignored
`.references/review/vehicles`.

## Devices checks

`npm run test:fleet -- devices.service.spec.ts --skip-nx-cache` checks IMEI/assignment
validation, scoped calls and constraint mapping. `devices.db.spec.ts` checks exact digits,
leading zeros, per-Tenant/Store uniqueness, same-tenant/same-store FK, shared Vehicles, protected Vehicle deletion,
reassignment, scoped CRUD and list queries.

```bash
npm run test:admin -- --include="app/features/fleet/devices/*.spec.ts" --include=app/features/fleet/relation-picker.spec.ts --include=app/features/fleet/fleet-workspace.spec.ts --skip-nx-cache
npm run test:smoke:admin -- angular-devices.smoke.spec.mts
```

Controlled Angular tests cover captured clients, typed forms, remote Vehicle selection, field
focus, delayed writes and sequential deletion retirement/retry. Real browser cases check
persistent assignments/reassignment/uniqueness, scope and Bulgarian desktop/narrow light/dark
views. Captures belong in ignored `.references/review/devices`.

## Angular admin checks

`--include` paths are relative to `apps/admin/src`; `--filter` selects case names.
Use `VITEST_MAX_WORKERS=1` on CPU-constrained hosts without changing case deadlines.

```bash
npm run test:admin -- --include=app/features/stores/store-workspace.spec.ts --skip-nx-cache
npm run test:admin -- --include=app/features/fleet/fleet-workspace.spec.ts --skip-nx-cache
npm run test:admin -- --include=app/core/config/admin-config.spec.ts --skip-nx-cache
npm run test:admin -- --include=app/core/graphql/graphql-options.spec.ts --skip-nx-cache
npm run test:admin -- --include=app/layout/appearance.spec.ts --skip-nx-cache
```

Store/workspace tests prove independent login layout, sequential Tenant/Store selection, cancellation
of obsolete candidate tokens and Store discovery, tenant A → B → A, direct/default Vehicles navigation, A → B → A, cancellation on Store/language
change, unknown Store and disabled Fleet behavior. Feature APIs prove retired submitted-write
success/failure and isolated caches. Real transport uses `angular-foundation.smoke.spec.mts`;
Sakai focus/theme/resizing/mobile behavior uses `angular-shell.smoke.spec.mts`.
Behavioral checks and visual review are separate evidence. Compare matching viewport sizes
against the pinned [Sakai source](../development.md#sakai-source-reference).

## Tenant sessions and migrations

```bash
npm run test:core -- demo-auth.spec.ts --skip-nx-cache
npm run test:core:db -- persistence.db.spec.ts stores.db.spec.ts initial-migration.db.spec.ts
npm run test:fleet:db -- vehicles.db.spec.ts devices.db.spec.ts initial-migration.db.spec.ts seeds.db.spec.ts
npm run test:admin -- --include=app/features/stores/tenant-session.spec.ts --include=app/core/auth/demo-session.spec.ts --skip-nx-cache
npm run test:smoke:admin -- angular-tenants.smoke.spec.mts
```

Session checks cover signatures, tampering, expiry, production opt-in, unauthenticated reads and
ignored tenant headers. DB/federation tests exercise scoped discovery/CRUD/entity resolution,
identical Store IDs and IMEIs across tenants, composite relation rejection and seed idempotency.
Initial-migration tests deploy the complete schema in dedicated guarded databases, then check
mandatory tenant columns, physical id/tenantId column order and the single applied initial migration. They never touch
development tables. Angular tests cover logged-out deep links, Tenant/Store dropdown gating and retry, obsolete candidate
responses, root-to-Vehicles navigation, remembered Store selection, tenant client/cache retirement,
delayed submitted writes and fresh A → B → A clients. Browser login checks use the actual dropdown,
logout/reload and desktop/narrow light/dark views; fixture auto-login is disabled for that suite.

## Karma Client checks

```bash
npm run test:karma-client -- accounts.spec.ts history.spec.ts location.spec.ts edata.spec.ts edata.service.spec.ts karma-client.spec.ts cars.service.spec.ts health.spec.ts --skip-nx-cache
npm run test:admin -- --include=app/features/karma-client/karma-phase4.spec.ts --include=app/features/karma-client/karma-phase3.spec.ts --include=app/features/karma-client/karma-phase2.spec.ts --include=app/features/karma-client/edata-page/edata-page.spec.ts --include=app/features/karma-client/karma-workspace.spec.ts --include=app/features/stores/store-workspace.spec.ts --skip-nx-cache
npm run test:gateway:db -- federation.db.spec.mts
npm run test:smoke:admin -- angular-karma-phase4.smoke.spec.mts angular-karma-phase3.smoke.spec.mts angular-karma-phase2.smoke.spec.mts angular-edata.smoke.spec.mts angular-karma.smoke.spec.mts angular-foundation.smoke.spec.mts angular-shell.smoke.spec.mts
```

The client checks cover response validation, credential absence, bounded transport failures,
concurrent login sharing, session reuse and one renewal after Karma's HTTP-200 session error.
Non-success HTTP bodies are cancelled before parsing; tests include stalled bodies and prevent
session renewal for unrelated HTTP failures.
Detail checks cover invalid IDs before upstream access, missing trucks and mismatched responses.
HTTP tests verify the signed session protocol and reject anonymous/invalid sessions before
upstream reads. Angular checks cover independence from Stores/Fleet, no Store header and
retirement across session/language/truck changes and logout, direct details and malformed IDs.

Federation and browser fixtures run the compiled Karma Client against a local controlled Karma
HTTP server. They never use live account credentials; the existing guarded Core/Fleet database
prerequisites still apply. Federation proves the common list/details across tenants/Stores, upstream
renewal and Fleet operation while Karma fails. Browser checks cover routing, Refresh, error/empty
states, Store switching, reload/language and disabled-Fleet/signed-out behavior. Detail browser
checks cover list links, direct routes, Refresh/retry, retained data and missing/invalid trucks.

The eData suites cover a 500-row upstream cap with complete traversal beyond that cap,
50-row boundaries without skips/duplicates, current-page snapshots when new messages arrive,
UTC/parameter encoding, cursor/filter scope, source ordering and response validation.
Angular checks cover zero/null detail values, URL state, cancellation on filter/truck/language/
session changes and logout, missing trucks and retained rows on refresh failure.
The eData browser fixture walks all 600 messages, tests Newer/Latest/reload/back, filters and
page-size selection, keyboard dialog close/focus restoration and desktop/mobile light/dark
captures under ignored `.references/review/`.

Location/reference checks cover all verified fields, null/zero values, plain-text escaping,
malformed/mismatched/duplicate upstream records, signed access to public version, fixed
field selection and a common abort budget across location existence/login/read/renewal.
Angular cases cover missing trucks, independent reference failure, label/ID hydration,
bookmarked reference pages, and retirement across truck/view/language/session/logout.
The browser suite checks complete-list search/pagination, retained Refresh failures,
null/invalid/empty location, map link safety, separate menu navigation and BG/EN
desktop/mobile light/dark captures under ignored `.references/review/`.

History checks cover 600-row traversal, endpoint-bound cursor scopes, source order and
IDs, inclusive bounds, short-trip-batch lookahead, selected event fields/codes/UTC
periods, malformed source data, missing cars, nine profile categories and null/zero.
Transport cases preserve one budget through existence/login/read/lookahead/renewal.
Angular cases cover direct routes, full dialogs and escaping, seven-day defaults,
filter/period retirement, truck A → B → A, language/logout and native form submission.
The compiled browser fixture covers trip/event traversal, reload/back/Latest/Newer,
size/date/code filters, keyboard dialog focus, retained profile refresh/retry, empty/
missing states and desktop/mobile light/dark captures. Real Gateway cases verify signed
shared-account access across tenants/Stores for all three queries. These deterministic
fixtures do not establish live provider uptime, active-trip semantics or score units.

Account tests cover all eleven user fields, original memberships, null/zero/plain text,
strict duplicate/shape validation, signed shared access before reads, renewal within the
four-second bound and sanitized failures. Angular checks cover URL paging/search, retained
refresh data, navigation/language/session cancellation and logout. Gateway verifies the
complete account arrays across two Tenants/Stores with controlled renewal, failure and empty
states. Browser cases cover local paging beyond 50, all-field dialogs/focus, menu navigation,
reload/language, retained failures and desktop/mobile light/dark captures. Use the native
`--testNamePattern='Karma users'` Gateway selector for this behavior.
