# Discocan contributor instructions

Apply the shared [coding guide](../../AGENTS.md), then read [the domain index](README.md)
and the relevant Fleet documents.

- Keep fleet telemetry documentation under `docs/discocan/`. Vehicles/Devices and their current
  Angular workspace belong to this domain, independently of Ecommerce workflows.
- A Branch represents a vehicle fleet in Discocan. Ecommerce uses the same Core Branch
  model for an online shop. Use Branch/branchId/x-branch-id consistently and preserve
  Tenant/Branch isolation.

## Fleet backend

- The [Simple eData vendor catalog](erm-resources/simple-edata-catalog/README.md) is
  shared manufacturer reference data scoped by catalog version, without Tenant/Branch
  columns. Its local offline importer has no API; DeviceOperations exposes only eligible
  predefined presets from the verified catalog for its controlled addition flow.
  Fleet business data retains mandatory Tenant/Branch isolation.

- Follow the actual [Vehicles resolver/service/repository](../../apps/fleet/src/modules/vehicles/vehicles.resolver.ts) and its [SDL](../../apps/fleet/src/modules/vehicles/vehicles.graphql). Use @Parent on a federation reference parameter when combining it with Nest parameter decorators; always resolve Vehicle/Device references through scoped service access.
- Branch access must always include the verified Tenant. Fleet persistence must always include the verified Tenant and active Branch, and related Fleet records use composite `(tenantId, branchId, …)` foreign keys. Creation and the settings upsert get Branch ID from context and check existence through Core. Ordinary business reads/updates/deletes remain independent of that network check; do not move blanket Branch validation into Gateway.
- Every Fleet list follows the [standard list contract](architecture.md#standard-list-contract): `offset`/`limit`/`search`/`ids`/`filter`/`sort` with `FleetSortDirection`, validation through the concrete helpers in `apps/fleet/src/validation.ts` and `apps/fleet/src/database/search.ts`, and repositories that write their own explicit predicates/order. Derived service urgency, Vehicles activity/last report/odometer, Devices connectivity, Drivers 30-day statistics and Trip duration are computed before filtering/sorting/paging/counting in concrete scoped raw queries proven by db specs. Each `allOf` keeps at most 50 nonrecursive conditions independent and AND-only.
- Links to other records return stored `…Ref` types loaded with the records or in scoped batches; a type with derived values is returned only by its own module (the documented exception is `FleetVehicle.nextService`). Retain derived facts used by list filters or sorting in the same `RepeatableRead` transaction as selection and totals: Vehicles state/OPEN counts, Devices status/last report, Drivers data clock and 30-day statistics, and Trips records/driving events/data clock. Map duration, maneuver count and in-progress state from captured Trip values. Later scoped batches may attach display-only values outside those list predicates, such as next service or Driver maneuver rate. `find`, federation references and mutation results use current-value helpers; no whole-GraphQL-response snapshot is promised. Do not add per-row `@ResolveField` queries or DataLoaders.
- Two clocks: telemetry values (activity, fuel freshness, trip windows, driver statistics) use the Branch data clock `asOf` from device samples only; business dates use `FleetClock.now()` in the configured Branch time zone, as do driver expiry and service urgency/completion-date validation. Vehicles created calendar filters use that zone; Overview daily buckets use the telemetry data-clock date in that zone. Trip/score/statistics periods stay fixed elapsed-day windows, independent of time zone. MANUAL odometer readings never move the data clock or the activity. Specs override `FleetClock` instead of reading the wall clock.
- The concrete [Settings module](../../apps/fleet/src/modules/settings/settings.module.ts) owns the unique Tenant/Branch `FleetSettings` row and `fleetSettings`/`updateFleetSettings` SDL. Reads return defaults without inserting: Sofia, KM, LITRE, low fuel 12%, not reporting 48 hours, speed reference 90 km/h. Full replacements validate the four supported zones and integer bounds 1–50%, 1–168 hours and 30–130 km/h; see [Branch settings](architecture.md#branch-settings). Pass scoped low-fuel/reporting values to TypeScript classifiers and use the concrete `settingsSql` default row inside the same SQL snapshot for derived predicates, sorting and displayed captured facts. Do not add a process-global cache or per-row settings reads. Other fixed thresholds/defaults remain in `apps/fleet/src/fleet-thresholds.ts`. Unit preferences do not change canonical km/kmh/litre measurements or numeric API filters. Speed is a stored reference; there is no generated-alert, device-command or notifications-provider integration. Branch naming belongs to [Core's selected Branch mutation](../ecommerce/branches.md#graphql-contracts), never a Fleet field or cross-application implementation import.
- Raw SQL is limited to vehicle/device/driver facts and derived lists/summaries, Trip duration/list/summary, Overview/daily distance, service urgency, score aggregates, the scoped settings/default row used by those queries, scoped Vehicle/Driver row locks and the demo seed's schema/Tenant/Branch advisory lock: `$queryRaw` with `Prisma.sql` only, every table through `fleetTable(schema, …)` with its own Tenant/Branch predicate, explicit parameter casts, `::int`/`::float8`/`::text` results and concrete row parsers from `apps/fleet/src/database/sql.ts`. Business clocks are parameters; derived lists read the scoped data clock and relevant settings in the same snapshot. Raw SQL never calls `now()`. Odometer and driver-assignment writes use READ COMMITTED with `FOR NO KEY UPDATE` and post-lock validation; Core calls stay outside the lock. The demo seed takes a transaction-scoped advisory lock keyed by seed identity/schema/Tenant/Branch before reserved-ID, natural-key and anchor checks, commits initial master/service-task and anchor-sample inserts together, then releases the lock before subsequent insert-only activity batches.
- Activity rows store the reporting IMEI as a snapshot, not a Device foreign key; vehicles and drivers with history are deactivated instead of deleted.
- Duplicates are BAD_USER_INPUT `fieldErrors` from a scoped pre-check plus `rethrowUniqueViolation` with the generated unique index names; foreign-key-blocked deletions are CONFLICT with an entity message.
- Branch discovery belongs to the shared [Core Branch foundation](../ecommerce/branches.md).
  Keep the domains' business workflows in their own documentation.

- Background parameter-configuration reads and changes belong to Fleet's concrete DeviceOperations
  module and database. Keep public reads Tenant/Branch-scoped; the trusted scheduler claims
  due rows across scopes and fences every write with the stored scope and lease token.
  Karma Client only executes its fixed machine-authenticated protocol. Preserve saved
  response fragments, baseline, write marker and uncertainty across restarts; never automatically
  replay an ambiguous submission or expose arbitrary command strings. Additions require the
  exact eligible Monitor catalog and observed profile; interval changes preserve every
  captured definition byte except the final two interval bytes, including unknown IDs.
  Keep the 120-second conservative preflight age, lease/deadline budget checks, one-definition
  `02` write and independent whole-set verification with separate profile/parameter watermarks.
  Interval zero means Monitor's special not-in-use setting, not deletion or proven silence.
  Never treat queue acceptance, delivery state or an expired local deadline as proof that
  a write was applied, rejected or cancelled. Follow the
  [implemented operation contract](architecture.md#background-device-configuration-reads).

## Angular admin (apps/admin)

- Follow [holita-admin-development](../../.agents/skills/holita-admin-development/SKILL.md) for this
  application and the official [angular-developer](../../.agents/skills/angular-developer/SKILL.md)
  for framework conventions. Use the official PrimeNG plugin/MCP for current component APIs;
  [installation](../development.md#angular-agent-tools) is documented separately.
- Keep standalone Angular and Component → concrete feature service → Apollo with generated
  TypedDocumentNodes through the actual Gateway. Do not add generic CRUD, facades, repositories, duplicate API models or duplicate
  business screens. Business editors use typed Reactive Forms.
- Each session/branch/language workspace owns its client/cache and immutable transport scope. Recreate
  the feature boundary on navigation, dispose reads and let submitted writes settle against
  their captured client. Late results, invalidation and callbacks must not affect another workspace.
  Prove A → B → A and delayed reads/writes through the concrete Angular feature tests.
- Prefer PrimeNG components and theme tokens; keep global CSS minimal, feature styles local and
  remove unused demo rules. Do not add wrappers without concrete reuse or depend on the
  deprecated PrimeNG Editor.
- The [admin design system](../admin-design-system.md) owns shell and feature visual design and
  responsive composition; follow the
  [admin design-system skill](../../.agents/skills/holita-admin-design-system/SKILL.md). Karma pages
  keep their legacy classes only through `styles/_legacy-karma.scss`. Consult the Angular Fleet
  [implementation index](fleet.md) for contracts, validation and scoped lifecycles.
- Keep the shell independent of business data access, with explicit inputs/outputs and only
  implemented navigation. Preserve Bulgarian/English catalogs, keyboard/mobile behavior and
  light/dark themes, with focused tests and visual review at matching viewport sizes.
- Angular provides Branch discovery and live Overview, Alerts, Vehicles/profile/odometer, Trips,
  Drivers/scorecard, Maintenance, Devices and Vehicle groups using the shared Storybook views.
  URL conditions map explicitly to each generated contract; whole-Branch summaries remain
  independent of list paging. Row/selection actions use one concrete scoped IDs-array mutation
  where a batch is supported. Preserve per-record failures, failed selections/retry and
  captured-scope completion after navigation. Submitted writes retain
  their captured scope, and obsolete callbacks cannot navigate or notify another workspace. Fleet startup
  availability gates navigation and direct routes without business requests. Standalone login selects
  Tenant then Branch and opens Overview. Do not add a Branch list landing page; the header retains
  Branch switching, which preserves the current Fleet section and resets record/query context.
  Add another feature only when explicitly requested.
- Devices require a 15-digit string IMEI unique per Tenant/Branch; Vehicle assignment is optional
  and, when set, must belong to the same Tenant/Branch. Unassigned devices are stock.
  Multiple Devices may share a Vehicle. Preserve leading zeros,
  composite foreign keys, protected Vehicle deletion and captured-client remote selection.

## Karma Client

- `apps/karma-client` owns the external Karma account connection and its `karmaCars`, `karmaCar(id: ID!)`, `karmaEdata(input: KarmaEdataInput!)`, `karmaLocation(carId: ID!)`, `karmaProjects`,
  `karmaTimeZones`, `karmaVersion`, `karmaTrips`, `karmaEvents`, `karmaDrivingProfile`, `karmaUsers` and `karmaRoles` queries.
  It is an independent host process with no database or Fleet implementation imports.
- Cars from the configured account are intentionally shared across every authenticated Tenant
  and Branch. Verify the signed session before upstream access; never require or use Branch context
  to filter the list, truck details, eData, location or references. This exception does not change Fleet Tenant/Branch isolation.
- Keep Karma credentials/session IDs on the server, bound the complete request, renew a rejected
  upstream session at most once and sanitize external failures. Do not expose arbitrary upstream paths.
- The admin section has its own `/bg/karma-client/cars` and `/en/karma-client/cars` routes.
  Keep it usable independently of Fleet availability and Branch discovery; retire its captured
  session/language/truck client on logout, language changes, truck changes and navigation.
  Truck details use `/cars/:recordId` under the same language-prefixed section.
  eData uses `/cars/:recordId/edata`, optional paired UTC/parameter filters and 25/50/100
  cursor pages. Preserve every verified message field, unknown parameter IDs and zero/null
  values; never infer units or a total count. Retire reads on filter/page changes as well.

- Location uses `/cars/:recordId/location`; preserve all verified fields, null/zero
  distinctions, raw text/timestamps/codes and the whole-operation bound including car
  existence. Do not infer online status or units. A map link requires two valid finite
  coordinates within latitude/longitude bounds; it opens only on user action.
- Account references use separate `/projects`, `/time-zones`, `/api-info` menus.
  Complete reference lists support local search/paging and URL state; lookup failures
  must not hide trucks or their original IDs. Public upstream version still requires
  a verified admin session through Gateway.

- Trips/events use separate `/cars/:recordId/trips` and `/cars/:recordId/events` pages,
  default 50 with 25/50/100 cursor sizes, paired optional dates and full row details.
  Trips use inclusive trip-ID bounds with bounded lookahead for short source batches;
  events use inclusive message-ID bounds, UTC dates and original code filters. Cursors
  bind kind/truck/size/filters/snapshot. No totals or event meanings are invented.
- `/cars/:recordId/driving-profile` exposes nine source category scores/weights for an
  editable seven-day initial period. Trip/profile date-zone semantics are unspecified;
  disclose API wall-clock interpretation. Preserve null/zero and source metric values;
  do not invent an overall rating, units or thresholds. Existence/read/lookahead/login/
  renewal share the four-second operation budget; retire filter/period reads on change.

- Account users/roles views preserve original relation IDs, ordered project memberships, raw
  active flag and nullable expiry text. Do not infer Karma role permissions, enable/disable
  state, expiry timezone or admin authorization from these values. Complete arrays use local
  URL search/paging; users details escape all text and restore trigger focus on close.
