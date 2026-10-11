# Implemented foundation requirements

| ID      | Implemented requirement                                                                                                                                                                              |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FND-001 | holita naming, npm workspaces, existing lockfile and Nx with four host applications: admin, gateway, core and reference.                                                                             |
| FND-002 | Strict TypeScript, concrete feature services/repositories, no cross-application implementation/model imports and no generic CRUD layer.                                                              |
| FND-003 | PostgreSQL-only Compose infrastructure; Core/Reference own separate development/test databases, roles, Prisma clients and reviewed SQL migrations.                                                   |
| FND-004 | Core discovers/looks up Stores. Seeds insert missing stable Stores without modifying existing rows.                                                                                                  |
| FND-005 | Schema-first federation, explicit offline operation/codegen inputs, generated ignored outputs and runtime SDL assets. Gateway uses a static supergraph.                                              |
| FND-006 | Every business predicate and entity lookup is Store-scoped. Creation validates the Store through Core once per request; reads/updates/deletes do not. Store context is not authorization.            |
| FND-007 | Request ID propagation, bounded upstream timeouts, standard Nest exceptions and hidden unexpected errors. Health works without database/downstream access.                                           |
| FND-008 | Vehicles CRUD has required License Plate up to 32 Unicode code points and nullable multiline Notes up to 2000; text is trimmed and NUL rejected.                                                     |
| FND-009 | Devices CRUD has mandatory exactly 15-digit string IMEI unique per Store and mandatory same-store Vehicle. Several Devices can share a Vehicle. Composite foreign keys protect assigned Vehicles.    |
| FND-010 | Vehicle/Device lists apply scoped literal search, server pagination/counting, supported sorting and deterministic ID ties.                                                                           |
| FND-011 | Standalone Angular → concrete API → generated TypedDocumentNode → Apollo → Gateway. Each mounted Store/language/resource/editor scope owns its client/cache.                                         |
| FND-012 | A → B → A creates a fresh workspace. Retired reads/callbacks cannot affect another view. Submitted writes settle with their captured client and scope.                                               |
| FND-013 | Store selection opens Vehicles. Store switching preserves Vehicles/Devices and resets list context; language switching preserves path/query/hash. Unknown Stores issue no business requests.         |
| FND-014 | Typed Reactive Forms, validation/server-field focus, retained rejected drafts, optional Notes null clearing and dirty route/unload guards. Device Truck selection uses remote Vehicle search/paging. |
| FND-015 | Confirmed single/page-local sequential deletion retains successful results, reports partial failures, supports failed-row retry and stops unsent writes on navigation.                               |
| FND-016 | Reference startup availability hides navigation and gates direct routes; backend availability gates business/entity operations while health/schema remain usable.                                    |
| FND-017 | Sakai/PrimeNG presentation, local Cyrillic-capable Lato, Bulgarian/English catalogs, persisted light/dark themes and accessible desktop/mobile navigation.                                           |
| FND-018 | One Store selector moves across the 992px breakpoint without losing drafts; Drawer focus/keyboard/close behavior and collapsed-sidebar inertness are preserved.                                      |
| FND-019 | Focused native runner selectors, isolated per-run DB schemas/processes, noncached DB/browser checks, real PR base/head selection and manual-only full regression.                                    |

Product identity is holita; red.bg is the temporary presentation domain.
This local foundation has no authentication or authorization. Health proves application
response, not database readiness or downstream service availability.
