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
  columns. Its local offline importer has no GraphQL or device-command interface.
  Vehicle/Device business data retains mandatory Tenant/Branch isolation.

- Follow the actual [Vehicles resolver/service/repository](../../apps/fleet/src/modules/vehicles/vehicles.resolver.ts) and its [SDL](../../apps/fleet/src/modules/vehicles/vehicles.graphql). Use @Parent on a federation reference parameter when combining it with Nest parameter decorators; always resolve Vehicle/Device references through scoped service access.
- Branch access must always include the verified Tenant. Fleet persistence must always include the verified Tenant and active Branch, and related Fleet records use composite `(tenantId, branchId, …)` foreign keys. Creation gets branch ID from context and checks existence through core. Do not make a branch existence network call for every business read/update/delete or move that blanket check into the gateway.
- Every Fleet list follows the [standard list contract](architecture.md#standard-list-contract): `offset`/`limit`/`search`/`ids`/`filter`/`sort` with `FleetSortDirection`, validation through the concrete helpers in `apps/fleet/src/validation.ts` and `apps/fleet/src/database/search.ts`, and repositories that write their own `where`/`orderBy` with generated Prisma types. Filters and sort keys use stored columns or stored relations only.
- Links to other records return stored `…Ref` types loaded in the same repository query; a type with derived values is returned only by its own module. Do not add per-row `@ResolveField` queries or DataLoaders.
- Business dates come from `FleetClock` (Europe/Sofia calendar date); specs override `FleetClock` instead of reading the wall clock. Thresholds live in `apps/fleet/src/fleet-thresholds.ts`.
- Duplicates are BAD_USER_INPUT `fieldErrors` from a scoped pre-check plus `rethrowUniqueViolation` with the generated unique index names; foreign-key-blocked deletions are CONFLICT with an entity message.
- Branch discovery belongs to the shared [Core Branch foundation](../ecommerce/branches.md).
  Keep the domains' business workflows in their own documentation.

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
- Prefer PrimeNG components and theme tokens. Sakai supplies the shell/layout reference;
  keep global CSS minimal, feature styles local and remove unused demo rules. Do not add
  wrappers without concrete reuse or depend on the deprecated PrimeNG Editor.
- Sakai is the Angular admin's theme and owns shell/feature visual design and responsive composition. Consult
  the Angular Vehicles/Devices implementation index for contracts, validation and scoped lifecycles.
- Use the pinned local Sakai source in `.references/sakai-ng` for layout comparisons;
  [setup and source paths](../development.md#sakai-source-reference) are documented separately.
  It is ignored reference material, not an npm/Nx application or runtime dependency.
- Keep the shell independent of business data access, with explicit inputs/outputs and only
  implemented navigation. Preserve Bulgarian/English catalogs, keyboard/mobile behavior and
  light/dark themes, with focused tests and visual review at matching viewport sizes.
- Angular provides Branches discovery and Fleet Vehicles/Devices CRUD with page-local sequential
  deletion. Preserve assigned-Vehicle failures, partial results, failed-row retry and stopping
  unsent deletes on navigation; submitted writes retain their captured scope. Fleet startup
  availability gates navigation and direct routes without business requests. Standalone login selects
  Tenant then Branch and opens Vehicles. Do not add a Branch list landing page; Fleet navigation
  contains Vehicles/Devices, and the header retains Branch switching; switching Branches preserves the active Vehicles/Devices section and resets queries.
  Add another feature only when explicitly requested.
- Devices require a 15-digit string IMEI unique per Tenant/Branch and a mandatory same-tenant/same-branch Vehicle,
  labeled Truck in the editor. Multiple Devices may share a Vehicle. Preserve leading zeros,
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
