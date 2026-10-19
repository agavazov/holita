# Current holita integration

This reference maps the external API to existing code. The shared domain
[architecture](../../architecture.md#karma-client) remains authoritative for
application ownership and lifecycle rules.

## Request path and ownership

```mermaid
flowchart LR
  A[Angular Karma view] --> B[Concrete Karma API service]
  B --> C[Generated GraphQL operation]
  C --> D[Apollo Router Gateway]
  D --> E[Karma Client subgraph]
  E --> F[Karma API v2]
```

The browser talks to Gateway. The native Apollo Router forwards the signed session
to the independent NestJS Karma Client. Concrete services call `requireTenant`
before upstream access. The application-local `KarmaTransportModule` provides one
`KarmaTransport` for fixed HTTP paths, upstream authentication and JSON reads. Feature
services own multi-read operation deadlines, query construction, car-existence checks and response
mapping into generated GraphQL types. History and Location reuse CarsService for their
actual car lookup; other features use the transport directly. Runtime SDL is explicitly loaded by
[AppModule](../../../../apps/karma-client/src/app.module.ts).

There is no database, Prisma model, ingestion worker, polling loop, telemetry archive,
Fleet implementation import or persisted Karma-to-Fleet identity mapping in this
subgraph. Health is a local process check and does not establish upstream availability.

`KARMA_API_URL`, `KARMA_USER` and `KARMA_PASSWORD` configure one server-side account;
`KARMA_CLIENT_GRAPHQL_URL` configures Gateway transport. Configuration is documented
in the single root [.env.example](../../../../.env.example), the
[development guide](../../development.md#karma-client), and the
[Router configuration](../../../../apps/gateway/router/router.yaml).

## Query, upstream and route mapping

Routes below follow `/:language/karma-client`, with `bg` or `en`. Every query is
authenticated and uses the common account regardless of active Branch.

| GraphQL query                                           | Concrete upstream operation                                 | Admin route / behavior                                                        |
| ------------------------------------------------------- | ----------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `karmaCars`                                             | GET `/cars`                                                 | `/cars`; complete account list and Refresh                                    |
| `karmaCar(id: ID!)`                                     | GET `/cars/{id}`                                            | `/cars/:recordId`; matching single truck or missing state                     |
| `karmaEdata(input: KarmaEdataInput!)`                   | GET `/edata`                                                | `/cars/:recordId/edata`; message/parameter details and cursor history         |
| `karmaLocation(carId: ID!)`                             | GET `/location` plus car precheck                           | `/cars/:recordId/location`; also independently loaded summary in truck detail |
| `karmaTrips(input: KarmaTripsInput!)`                   | GET `/trips` plus car precheck and possible older lookahead | `/cars/:recordId/trips`; full row details and cursor history                  |
| `karmaEvents(input: KarmaEventsInput!)`                 | GET `/events` plus car precheck                             | `/cars/:recordId/events`; UTC/code filters, details and cursor history        |
| `karmaDrivingProfile(input: KarmaDrivingProfileInput!)` | GET `/driving-profile` plus car precheck                    | `/cars/:recordId/driving-profile`; editable period, nine raw categories       |
| `karmaProjects`                                         | GET `/projects`                                             | `/projects`; complete-list local search/paging and truck name lookups         |
| `karmaTimeZones`                                        | GET `/time-zones`                                           | `/time-zones`; complete-list local search/paging and name lookups             |
| `karmaVersion`                                          | GET `/version`, no upstream login                           | `/api-info`; original version text                                            |
| `karmaUsers`                                            | GET `/users`                                                | `/users`; local search/paging and all-field detail dialog                     |
| `karmaRoles`                                            | GET `/roles`                                                | `/roles`; local search/paging and original descriptions                       |

Sources: [routes](../../../../apps/admin/src/app/features/karma-client/karma.routes.ts),
feature-owned operations for [cars](../../../../apps/admin/src/app/features/karma-client/cars/operations.graphql),
[eData](../../../../apps/admin/src/app/features/karma-client/edata/operations.graphql),
[location](../../../../apps/admin/src/app/features/karma-client/location/operations.graphql),
[history](../../../../apps/admin/src/app/features/karma-client/history/operations.graphql),
[references](../../../../apps/admin/src/app/features/karma-client/references/operations.graphql)
and [accounts](../../../../apps/admin/src/app/features/karma-client/accounts/operations.graphql),
[fixed HTTP client](../../../../apps/karma-client/src/integrations/karma/karma-transport.ts).
There are no public Karma mutations or arbitrary REST proxy operations.

## Backend feature boundaries

| Feature                | Concrete implementation                                                                                                                                                             | Contract / mapping                                                                                                                                                                                                                       |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Transport              | [KarmaTransport](../../../../apps/karma-client/src/integrations/karma/karma-transport.ts), [module](../../../../apps/karma-client/src/integrations/karma/karma-transport.module.ts) | Fixed upstream endpoints, shared session, authentication renewal and sanitized HTTP reads                                                                                                                                                |
| Cars                   | [CarsService](../../../../apps/karma-client/src/modules/cars/cars.service.ts)                                                                                                       | [SDL](../../../../apps/karma-client/src/modules/cars/cars.graphql), [response](../../../../apps/karma-client/src/modules/cars/cars-response.ts)                                                                                          |
| eData                  | [EdataService](../../../../apps/karma-client/src/modules/edata/edata.service.ts)                                                                                                    | [SDL](../../../../apps/karma-client/src/modules/edata/edata.graphql), [query](../../../../apps/karma-client/src/modules/edata/edata-query.ts), [response](../../../../apps/karma-client/src/modules/edata/edata-response.ts)             |
| Location               | [LocationService](../../../../apps/karma-client/src/modules/location/location.service.ts)                                                                                           | [SDL](../../../../apps/karma-client/src/modules/location/location.graphql), [response](../../../../apps/karma-client/src/modules/location/location-response.ts)                                                                          |
| Trips/events/profile   | [HistoryService](../../../../apps/karma-client/src/modules/history/history.service.ts)                                                                                              | [SDL](../../../../apps/karma-client/src/modules/history/history.graphql), [query](../../../../apps/karma-client/src/modules/history/history-query.ts), [response](../../../../apps/karma-client/src/modules/history/history-response.ts) |
| Projects/zones/version | [ReferencesService](../../../../apps/karma-client/src/modules/references/references.service.ts)                                                                                     | [SDL](../../../../apps/karma-client/src/modules/references/references.graphql), [response](../../../../apps/karma-client/src/modules/references/references-response.ts)                                                                  |
| Users/roles            | [AccountsService](../../../../apps/karma-client/src/modules/accounts/accounts.service.ts)                                                                                           | [SDL](../../../../apps/karma-client/src/modules/accounts/accounts.graphql), [response](../../../../apps/karma-client/src/modules/accounts/accounts-response.ts)                                                                          |

SDL owns public API types, generated by the existing GraphQL toolchain. The
reconstructed REST schema is not currently wired into this toolchain. Backend
services enforce signed access, while input/response helpers define the concrete
subset accepted by holita. See [field mapping](data-models.md) and
[transport rules](transport-and-authentication.md).

## Frontend behavior

[KarmaWorkspace](../../../../apps/admin/src/app/features/karma-client/karma-workspace.ts)
mounts the selected route section using the captured session, language, truck and
section. Concrete view providers own Apollo clients/caches through
[KarmaApi](../../../../apps/admin/src/app/features/karma-client/karma-api.ts),
[KarmaEdataApi](../../../../apps/admin/src/app/features/karma-client/edata/karma-edata-api.ts)
and [KarmaHistoryApi](../../../../apps/admin/src/app/features/karma-client/history/karma-history-api.ts).
Their generated TypedDocumentNodes go through Gateway with `network-only` reads.
They capture the admin session and send no Branch context.

The section remains accessible when Fleet is disabled or Branch discovery fails.
Changing Branch remembers that selection without reloading Karma. Navigation,
language changes, truck changes, session replacement and logout retire old reads
and clients. Filter/period/cursor changes cancel obsolete reads and clear old rows;
same-query Refresh can retain the last successful result on error. There is no
automatic polling or command/write UI.

The car table requests all cars, not a server-paginated/searchable list. Its list
operation selects basic fields and timezone but omits `subType` and `driverCount`;
the detail operation selects them. Name hydration uses an independent projects/zones
query so failed reference lookup cannot hide truck data or original IDs.

Projects, time zones, users and roles load complete arrays and perform local
search/paging with exact totals for that loaded array. URL state uses `q`, `size`
and `first`; page sizes are 25/50/100, default 50. These totals do not imply history
totals or server completeness guarantees beyond the returned list.

eData/trips/events expose full row dialogs and Latest/Older/Newer cursor navigation.
Applied size, dates and parameter/event filters are URL-backed. User dialogs display
all eleven source fields and restore focus when closed. Text is escaped; `extra`
and role descriptions are not interpreted as HTML or authorization.

Driving profile starts from a seven-day range derived from the current UTC clock,
then submits its offset-free wall-clock strings. The period is editable and the UI
discloses the unresolved provider timezone. The nine source categories are shown
without a fabricated overall score, thresholds or units.

Location exposes all mapped fields and an OpenStreetMap link only when both
coordinates are valid. Map opening is a user action; no embedded map SDK or map
request runs automatically. A separate detail summary can fail independently of
the truck details. No online/offline badge is derived from timestamps or zero values.

## Existing verification coverage

This is a map of existing suites, not a record of an individual run. Commands and
prerequisites belong to [Discocan testing](../../testing.md#karma-client-checks).

| Layer               | Suites / fixtures                                                                                                                                                              | What they establish                                                                                                                         |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Backend transport   | [cars.spec.ts](../../../../apps/karma-client/src/modules/cars/cars.spec.ts), [cars.service.spec.ts](../../../../apps/karma-client/src/modules/cars/cars.service.spec.ts)       | Fixed reads, canonical IDs, leading zeros, login sharing, renewal, missing details, bounded failures, sanitization and shared signed access |
| eData               | [edata.spec.ts](../../../../apps/karma-client/src/modules/edata/edata.spec.ts), [edata.service.spec.ts](../../../../apps/karma-client/src/modules/edata/edata.service.spec.ts) | Traversal beyond fixture batch caps, snapshot cursors, UTC/array encoding, response/filter checks and signed access                         |
| Location/references | [location.spec.ts](../../../../apps/karma-client/src/modules/location/location.spec.ts)                                                                                        | All mapped fields, null/zero, selected fields, whole-operation signal, reference validation and signed public-version access                |
| Histories/profile   | [history.spec.ts](../../../../apps/karma-client/src/modules/history/history.spec.ts)                                                                                           | ID-bound paging, short-trip lookahead, event filtering, null/zero and nine categories                                                       |
| Accounts/health     | [accounts.spec.ts](../../../../apps/karma-client/src/modules/accounts/accounts.spec.ts), [health.spec.ts](../../../../apps/karma-client/src/health/health.spec.ts)             | Eleven user fields, ordered memberships, duplicates, role text, authentication and local health                                             |
| Angular             | `karma-workspace.spec.ts`, `edata/edata-page/edata-page.spec.ts`, `location-references.spec.ts`, `history/history.spec.ts`, `accounts/accounts.spec.ts` in the Karma feature   | Captured clients, routes, filters, retained refresh data, escaping, dialogs, reference failure and cancellation                             |
| Federation          | [federation.db.spec.mts](../../../../tools/graphql/federation.db.spec.mts), [controlled Karma server](../../../../tools/graphql/karma-fixture.mts)                             | Real service boundaries with local controlled upstream and dedicated Core/Fleet schemas                                                     |
| Browser             | Karma/eData smoke suites listed in the testing guide                                                                                                                           | Compiled-app routing, history/dialog interactions, refresh behavior and scoped navigation                                                   |

Deterministic fixtures establish holita behavior under controlled responses. They
do not establish provider uptime, permission to write, a complete field catalog,
non-null sensor/driver/video models, real active-trip mutation behavior, metric
units or timezone semantics. Live read observations complement these fixtures;
they do not replace them or constitute a full account/history audit.
