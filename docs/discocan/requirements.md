# Implemented Discocan requirements

These requirements cover the existing Fleet modules and telemetry admin. They use the
current Store contracts; [Branches terminology](README.md#terminology) is a future domain change.
[Shared foundation requirements](../req/foundation.md) apply to the workspace.

| ID        | Implemented requirement                                                                                                                                                                                                                                                                   |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FND-006   | Every Fleet business predicate and entity lookup is Tenant/Store-scoped. Creation validates the Store through Core once per request; reads/updates/deletes do not. Store context is not authorization.                                                                                    |
| FND-008   | Vehicles CRUD has required License Plate up to 32 Unicode code points and nullable multiline Notes up to 2000; text is trimmed and NUL rejected.                                                                                                                                          |
| FND-009   | Devices CRUD has mandatory exactly 15-digit string IMEI unique per Store and mandatory same-tenant/same-store Vehicle. Several Devices can share a Vehicle. Composite foreign keys protect assigned Vehicles.                                                                             |
| FND-010   | Vehicle/Device lists apply scoped literal search, server pagination/counting, supported sorting and deterministic ID ties.                                                                                                                                                                |
| FND-011   | Standalone Angular → concrete API → generated TypedDocumentNode → Apollo → Gateway. Each mounted session/Store/language/resource/editor scope owns its client/cache.                                                                                                                      |
| FND-012   | A → B → A creates a fresh workspace. Retired reads/callbacks cannot affect another view. Submitted writes settle with their captured client and scope.                                                                                                                                    |
| FND-013   | Standalone login requires sequential Tenant/Store selection and opens Vehicles. No Store landing page; Fleet menu and header Store switching preserves Vehicles/Devices and resets list context; language switching preserves path/query/hash. Unknown Stores issue no business requests. |
| FND-014   | Typed Reactive Forms, validation/server-field focus, retained rejected drafts, optional Notes null clearing and dirty route/unload guards. Device Truck selection uses remote Vehicle search/paging.                                                                                      |
| FND-015   | Confirmed single/page-local sequential deletion retains successful results, reports partial failures, supports failed-row retry and stops unsent writes on navigation.                                                                                                                    |
| FND-016   | Fleet startup availability hides navigation and gates direct routes; backend availability gates business/entity operations while health/schema remain usable.                                                                                                                             |
| FND-017   | Sakai/PrimeNG presentation, local Cyrillic-capable Lato, Bulgarian/English catalogs, persisted light/dark themes and accessible desktop/mobile navigation.                                                                                                                                |
| FND-018   | One Store selector moves across the 992px breakpoint without losing drafts; Drawer focus/keyboard/close behavior and collapsed-sidebar inertness are preserved.                                                                                                                           |
| KARMA-001 | A separate Karma Client process exposes a signed-session-only common account cars list through Gateway, without Store scoping or persistence.                                                                                                                                             |
| KARMA-002 | The independent Karma Client admin section provides a read-only BG/EN truck table and Refresh, with loading/error/empty states and retired session/language reads.                                                                                                                        |

Seeds insert sample Vehicles/Devices under RentalSofia's Discordia Store without modifying
existing rows. Store seed ownership is described in [Ecommerce Stores](../ecommerce/stores.md).
The implemented demo login selects a Tenant and then one of its Stores without a password.
A candidate signed, expiring token discovers only that Tenant's Stores; the UI session starts
after submission with a valid Store. Anyone can choose any Tenant; real user identity, tenant
membership, permissions and session revocation must be implemented before production.
Vehicle and Device require tenantId physically second after id in PostgreSQL.
