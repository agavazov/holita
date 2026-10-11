# Discocan focused checks

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
