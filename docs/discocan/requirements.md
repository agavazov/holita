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
| KARMA-003 | Registration links open authenticated global truck details with validated IDs, verified basic fields, Refresh/return navigation, missing/error states and retired truck-specific reads.                                                                                                   |
| KARMA-004 | A separate truck eData page provides latest-50 cursor pagination (25/50/100), optional paired UTC/parameter-ID filters, complete message/parameter detail, preserved zero/null values and scoped read cancellation.                                                                       |

| KARMA-005 | A separate truck location page and independent detail summary preserve all verified last-known fields, null/zero coordinates and plain text; only valid coordinate pairs create a map link, without online-status or unit inference. |
| KARMA-006 | Projects, time zones and API version have separate authenticated global account views; complete reference lists use search and URL-backed local 25/50/100 pagination, resolved names preserve IDs and lookup failures do not block trucks. |
| KARMA-007 | Separate truck Trips/Events histories provide latest-50 scoped cursor paging, paired optional periods, original event-code filters and full raw details; Driving profile provides nine nullable category score/weight pairs for an editable seven-day starting period, with no inferred units/scales/timezone or combined rating. |
| KARMA-008 | Separate signed global Users/Roles menus expose complete account lists with URL search and local 25/50/100 paging (default 50), all eleven user fields in a keyboard-accessible dialog, preserved zero/null/project arrays and original role descriptions without permission inference. |

Seeds insert sample Vehicles/Devices under RentalSofia's Discordia Store without modifying
existing rows. Store seed ownership is described in [Ecommerce Stores](../ecommerce/stores.md).
The implemented demo login selects a Tenant and then one of its Stores without a password.
A candidate signed, expiring token discovers only that Tenant's Stores; the UI session starts
after submission with a valid Store. Anyone can choose any Tenant; real user identity, tenant
membership, permissions and session revocation must be implemented before production.
Vehicle and Device require tenantId physically second after id in PostgreSQL.

## Shared vendor reference data

The [versioned Simple eData catalog](erm-resources/simple-edata-catalog/README.md) is common
manufacturer metadata without Tenant/Store scope. An offline EXE-only extractor preserves
all supported workbook variants, Monitor tables, conflicts and provenance. A local CLI
imports versions transactionally and verifies repeated imports. This has no GraphQL/admin
or device-command integration and does not change FND-006 business-entity isolation.
