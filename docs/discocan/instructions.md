# Discocan contributor instructions

Apply the shared [coding guide](../../AGENTS.md), then read [the domain index](README.md)
and the relevant Fleet documents.

- Keep fleet telemetry documentation under `docs/discocan/`. Vehicles/Devices and their current
  Angular workspace belong to this domain, independently of Ecommerce workflows.
- Current telemetry Stores represent organizational branches and will later become Branches.
  Use actual Store/storeId/x-store-id names for current contracts. Preserve Tenant/Store isolation
  until an explicitly requested implementation changes those contracts.

## Fleet backend

- Follow the actual [Vehicles resolver/service/repository](../../apps/fleet/src/vehicles/vehicles.resolver.ts) and its [SDL](../../apps/fleet/src/vehicles/vehicles.graphql). Use @Parent on a federation reference parameter when combining it with Nest parameter decorators; always resolve Vehicle/Device references through scoped service access.
- Store access must always include the verified Tenant. Vehicle/Device persistence must always include the verified Tenant and active Store. Creation gets store ID from context and checks existence through core. Do not make a store existence network call for every business read/update/delete or move that blanket check into the gateway.
- Store discovery itself belongs to the [Core Store foundation](../ecommerce/stores.md), which
  Discocan currently consumes. Do not turn its future Branch distinction into online-store rules.

## Angular admin (apps/admin)

- Follow [holita-admin-development](../../.agents/skills/holita-admin-development/SKILL.md) for this
  application and the official [angular-developer](../../.agents/skills/angular-developer/SKILL.md)
  for framework conventions. Use the official PrimeNG plugin/MCP for current component APIs;
  [installation](../development.md#angular-agent-tools) is documented separately.
- Keep standalone Angular and Component → concrete feature service → Apollo with generated
  TypedDocumentNodes through the actual Gateway. Do not add generic CRUD, facades, repositories, duplicate API models or duplicate
  business screens. Business editors use typed Reactive Forms.
- Each session/store/language workspace owns its client/cache and immutable transport scope. Recreate
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
- Angular provides Stores discovery and Fleet Vehicles/Devices CRUD with page-local sequential
  deletion. Preserve assigned-Vehicle failures, partial results, failed-row retry and stopping
  unsent deletes on navigation; submitted writes retain their captured scope. Fleet startup
  availability gates navigation and direct routes without business requests. Standalone login selects
  Tenant then Store and opens Vehicles. Do not add a Store list landing page; Fleet navigation
  contains Vehicles/Devices, and the header retains Store switching; switching Stores preserves the active Vehicles/Devices section and resets queries.
  Add another feature only when explicitly requested.
- Devices require a 15-digit string IMEI unique per Tenant/Store and a mandatory same-tenant/same-store Vehicle,
  labeled Truck in the editor. Multiple Devices may share a Vehicle. Preserve leading zeros,
  composite foreign keys, protected Vehicle deletion and captured-client remote selection.

## Karma Client

- `apps/karma-client` owns the external Karma account connection and its `karmaCars` query.
  It is an independent host process with no database or Fleet implementation imports.
- Cars from the configured account are intentionally shared across every authenticated Tenant
  and Store. Verify the signed session before upstream access; never require or use Store context
  to filter this list. This exception does not change Fleet Tenant/Store isolation.
- Keep Karma credentials/session IDs on the server, bound the complete request, renew a rejected
  upstream session at most once and sanitize external failures. Do not expose arbitrary upstream paths.
- The admin section has its own `/bg/karma-client/cars` and `/en/karma-client/cars` routes.
  Keep it usable independently of Fleet availability and Store discovery; retire its captured
  session/language client on logout, language changes and navigation.
