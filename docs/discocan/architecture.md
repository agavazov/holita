# Discocan architecture

Discocan covers fleet telemetry. Its implemented modules are Fleet Vehicles and Devices.
The [shared architecture](../architecture/overview.md) describes applications, execution and tooling.
Current Store terminology and the future Branch terminology are explained in [the domain index](README.md#terminology).

## Persistence ownership

One PostgreSQL instance contains independent Core/Fleet development and test databases,
with distinct owner/login roles. Admin/Gateway have no Prisma client or database credentials.
Each owning service has its own schema, reviewed SQL migrations and generated client.
Core owns the [Tenant/Store foundation](../ecommerce/stores.md) currently reused as Discocan organizational scope.
Fleet owns Vehicle and Device. Each service has one initial migration for its complete schema. Store, Vehicle and Device have mandatory tenantId physically second after id; Tenant data is inserted by the seed, not by schema migrations.

Vehicle has UUID, tenantId, storeId, required License Plate (32 characters), nullable Notes (2000
characters) and timestamps. License Plate is not unique. Device has UUID, tenantId, storeId, required
15-digit IMEI, required vehicleId and timestamps. IMEI stays a string, preserving leading zeros.
A unique `(tenantId, storeId, imei)` index and SQL digit CHECK protect persistence. The composite
`(tenantId, storeId, vehicleId)` foreign key references Vehicle `(tenantId, storeId, id)` with restricted deletion
and update. Several Devices may share a Vehicle. There is no cross-database Store foreign key.
Seeds insert RentalSofia, the stable Discordia and Sandbox Stores, two Discordia Vehicles and one Device. Repeated seeds skip existing keys and never overwrite edits. Fleet has no cross-database Tenant/Store foreign key; creation verifies the tenant-scoped Store through Core. Mandatory tenant predicates and composite indexes enforce application isolation; PostgreSQL has no row-level-security policy. Direct SQL access by the owning role can access every tenant.

Tests deploy migrations into random schemas in dedicated test databases and drop only their
own schema. Development connections, broad resets and shared truncation are not test fixtures.

## GraphQL contracts and context

[Core SDL](../../apps/core/src/stores/stores.graphql),
[Vehicle SDL](../../apps/fleet/src/vehicles/vehicles.graphql) and
[Device SDL](../../apps/fleet/src/devices/devices.graphql) define the API.
Vehicle SDL also declares the Fleet federation link, DateTime, Store reference and root types.
Backend resolvers use generated types and delegate to concrete services/repositories.
Runtime SDL assets are copied into builds. Named Angular/Core lookup operations are explicit
inputs in [contracts.mts](../../tools/graphql/contracts.mts). Codegen/composition/validation work
offline. Gateway loads a generated static supergraph without introspection or registry polling.

Public demo discovery exposes tenants and demoLogin. Core/Fleet authenticated queries are stores, store, fleetVehicles, fleetVehicle, fleetDevices and fleetDevice. Mutations create/update/delete FleetVehicle and FleetDevice.
All Store/business operations require a signed demo session in Authorization. Business operations additionally require a valid `x-store-id` UUID. Inputs never accept tenantId or storeId.
Repository predicates, totals, relation lookup and federation reference resolution always include the verified Tenant and active Store.
Foreign IDs appear as NOT_FOUND. Creation checks Store existence through Core once per
Fleet HTTP request; read/update/delete do not make that network call. Requesting a
federated Store field beyond its known ID (for example `store { name }`) asks Core to resolve
its persisted Store.

Vehicle search matches License Plate; Device search matches IMEI. Queries combine mandatory
Store scope with search/explicit ID filters, count before pagination and sort before slicing.
Default offset/limit are 0/20, limit is 1–100, and default sort is newest first. IDs break ties.
Search punctuation is literal. Text validation trims, counts Unicode code points and rejects NUL.
Notes can be cleared to null. Device validation requires a Vehicle from the same Store.

Gateway forwards Store context without blanket Store validation. Request IDs accept 1–100 ASCII
letters/digits or `._:-`; invalid/missing IDs are replaced with UUIDs. Responses/errors expose the
ID. Expected Nest exceptions map to BAD_USER_INPUT, NOT_FOUND, CONFLICT or SERVICE_UNAVAILABLE;
unexpected details remain hidden. Creation's Core timeout is 3 seconds, Gateway's subgraph timeout
is 5 seconds. No global current Store or cross-request Store validation cache exists.
Tenant identity comes only from the HMAC-verified, expiring session. Gateway forwards Authorization; Core, Fleet and Karma Client independently verify it. Arbitrary tenant headers and entity representations cannot select a Tenant. Demo login deliberately allows anyone to choose any Tenant; it is not production identity or membership authorization.

`FLEET_ENABLED=false` rejects Fleet business and entity operations while preserving
schema composition and health. Angular startup availability hides navigation and gates direct routes.

## Angular admin foundation

The standalone Angular flow is component → concrete feature API → generated TypedDocumentNode
→ Apollo Angular/HttpLink → Gateway. Login owns the standalone Sakai login view and sequential
Tenant/Store selection. A candidate token loads tenant-scoped Stores through a disposable client;
changing Tenant cancels discovery and ignores late tokens. Submitting a valid Store activates the
tab session and opens Vehicles. StoreWorkspace owns authenticated discovery and route selection;
the shell receives explicit inputs and emits Store changes without business data access.
Routes use `/bg` or `/en`, then `/:storeId/fleet/vehicles` or `/devices`, with `/new`
and `/:recordId/edit`. Previous `/reference` URLs redirect to `/fleet`, preserving the resource,
editor path, query parameters and fragment. The language root shows Login while signed out and redirects to the saved
(or first available) Store's Vehicles while signed in. There is no Store list landing page.
Fleet navigation contains Vehicles/Devices; the header keeps its Store switcher. Choosing a Store at login opens Vehicles; switching Stores preserves the enabled
current business section and resets list context. Language switching preserves path/query/hash.
Unknown Stores and disabled Fleet never start business requests.

FleetWorkspace keys child views by session/Store/language/resource/editor/ID. Each mounted page/editor
owns an immutable session/Store/language-scoped Apollo client and InMemoryCache. A → B → A creates a fresh A client.
Reads unsubscribe on retirement; submitted writes settle with their captured client and affect
only its cache. Obsolete callbacks cannot navigate, notify or mutate a new workspace.

Lists provide URL-backed search/sort/paging, selection and confirmed page-local sequential deletion.
Successful deletions remain removed after refresh failures; failed rows remain selected for retry.
Navigation retires confirmation callbacks and stops unsent deletes. Submitted writes still settle.
Typed Reactive Forms provide validation, server-field focus, null clearing, dirty navigation guards
and retained failed drafts. Device's remote Vehicle picker searches/pages through the captured
DevicesApi and hydrates the assigned Vehicle. Multiple Devices can use the same Vehicle.

The browser title is Admin. The header and login show only the logo mark.
Sakai defines the shell and feature presentation. The ignored [source](../development.md#sakai-source-reference)
is a visual reference only. PrimeNG Aura compatibility tokens and local Cyrillic-capable Lato use
Sakai's 14px root. Desktop header/sidebar are 56px/280px; content caps at 1504px on wide screens.
Below 992px, one Store selector moves into a second 56px row without resetting editor drafts.
The mobile Drawer traps focus and supports Escape/backdrop dismissal; collapsed desktop links
are inert. The footer carries holita. Light/dark preference uses `holita.admin.theme`; denied
storage leaves the toggle usable and reports its failure. Bulgarian/English catalogs supply UI text.
The trimmed preset contains implemented controls and their PrimeNG dependencies.
Public startup config selects GraphQL URL, availability and optional user-supplied PrimeUI license.

Demo sessions last eight hours and persist only in the browser tab sessionStorage. Logout navigates through the dirty-editor guard, clears the tab session and destroys discovery/business clients. Expiry retires the current workspace. Submitted writes retain their captured token and may settle after logout. Logout has no server-side token revocation. [Development](development.md#demo-tenant-login) describes configuration and production limitations.

## Karma Client

`apps/karma-client` is a separate NestJS federation subgraph. Gateway forwards the signed
admin session to its `karmaCars`, `karmaCar(id: ID!)`, `karmaEdata(input: KarmaEdataInput!)`,
`karmaLocation(carId: ID!)`, `karmaProjects`, `karmaTimeZones`, `karmaVersion`, `karmaTrips`, `karmaEvents`, `karmaDrivingProfile`, `karmaUsers` and `karmaRoles` queries. Karma Client verifies
that session independently and returns cars from one configured Karma account to all
authenticated tenants. No `x-store-id` is required or used; all Karma reads are intentionally global. Fleet isolation remains unchanged.

A concrete Karma client authenticates with `POST /login` and requests the complete `GET /cars`
list with `karma_sid`. It keeps the upstream session only in process memory and shares pending
logins across callers. HTTP 401 or the HTTP-200 `{error: "Not logged in"}` response discards only
the rejected session and retries login/read once. A four-second abort signal bounds the whole
operation, including login and retry, within Gateway's five-second subgraph timeout.
Non-success HTTP bodies are cancelled before JSON parsing; only HTTP 401 or a successful
HTTP response containing the session error triggers renewal. Malformed responses, transport
errors and other upstream errors become sanitized
`SERVICE_UNAVAILABLE` errors. Credentials and session IDs are never returned to the admin.

The generated `KarmaCar` GraphQL type exposes ID, Device ID, Project ID, registration number,
type/subtype, year, color, timezone ID and assigned-driver count. Runtime validation preserves
string device identifiers and normalizes numeric/text years to nullable strings. Subtype
and timezone ID remain nullable; driver count is the length of the returned `driver_ids`
array, preserving zero and absent values separately. There is no database, migration, row cache or mapping
to Fleet Vehicles/Devices. The health endpoint does not contact Karma.

Truck details use `GET /cars/{id}` and require a canonical positive safe-integer ID before
upstream access. An empty response array or HTTP 404 becomes a nullable `karmaCar`; multiple
records or a mismatched ID are rejected. Unknown optional SIM/video content is not exposed.

Angular owns a fresh Apollo client/cache for each mounted session/language/truck view and sends
no Store header. The route is mounted while authenticated even when Store discovery is empty
or fails and when Fleet is disabled. Changing the Store on this page updates the remembered
Store without navigation or reloading Karma. Navigation, language changes, session replacement
and logout retire obsolete reads. Refresh retains the previous successful rows on failure.
The read-only table fetches all rows on entry or Refresh. Registration links open a dedicated
`/cars/:recordId` detail route with the verified car fields, Refresh and a return link.
Registration links use the shared `content-link` styling, matching the Fleet tables in both themes.
Missing/invalid IDs show a not-found message; refresh failures retain previous details.
All Karma views have Bulgarian/English labels and use the existing Sakai/PrimeNG theme.

The concrete eData feature validates car/message/parameter IDs as positive safe integers
represented by GraphQL IDs. It maps all verified message fields and numeric parameter
ID/value/description readings, preserving zero, null, leading-zero device identifiers and
unknown parameter IDs. `spd`, `odo` and `pdt` retain their source names because their units
or timestamp semantics have not been established. Descriptions are requested with `showdesc=1`.

A page performs one fixed GET `/edata` read, which returns the latest up to 500 matching
messages in ascending ID order. The service reverses them and selects 25, 50 (default) or 100. `hasMore` is true when the response contains more than the requested page size; no
total is fabricated. The next cursor sets inclusive `to_id` to the last displayed ID minus
one, preserving all messages within the upstream batch. Opaque cursors contain the normalized
truck/filter/page-size scope, current upper bound and initial snapshot ID. The returned
current-page cursor allows Newer to restore that upper bound even if newer messages arrive.
Dates are optional paired UTC bounds and apply to `edt`; at most 25 unique parameter IDs
use the verified bracketed GET syntax. Inputs and response scope/order/bounds are checked;
malformed data or upstream errors produce sanitized errors.

`/bg/karma-client/cars/:recordId/edata` and its English equivalent load the truck directly,
then its message page. The table shows UTC event time, message ID and parameter count;
a modal exposes every message field and a complete parameter table. Applied filters and
cursor stay in the URL. Browser history stores only previous cursor metadata for Newer,
including across reload/back; a separately opened cursor URL or language change can reset
that trail, while Latest remains available. Latest refreshes the current filter's newest
messages. Navigation/filter changes cancel obsolete reads and clear prior rows; only
same-page Refresh retains rows on failure. No polling, persistence or writes are added.

Location uses fixed GET `/location` with scalar `car` and bracketed `fields[]` selections
for `spd`, `odo`, `edt_tz` and `pdt`. The same four-second signal covers car existence,
login/renewal and location. Missing cars return null before querying their location; an
empty location array is also null, while a last-message envelope with null coordinates
remains visible. Business error objects, multiple/mismatched rows and malformed fields
become sanitized errors. Message/event IDs are strings; event code zero is preserved.
`extra` is plain text; timestamp/code/metric values retain source names without inferred
units, timezone conversion or online status. Finite out-of-range coordinates remain
inspectable but cannot produce a map link.

The separate `/cars/:recordId/location` page loads the truck then its location, exposes
all 13 verified fields and offers an OpenStreetMap link only for valid coordinate pairs.
Zero coordinates are valid. Maps open on user action in a new tab; no map SDK or embedded
map requests are used. Truck details load a last-known summary independently; its failure
does not hide the truck.

Concrete reference reads validate complete project/time-zone lists, reject duplicate IDs
and expose original names. `/projects`, `/time-zones` and `/api-info` have separate account
menu entries under both language-prefixed Karma sections. Project/time-zone search and
local pagination cover the full returned list, with exact totals and 25/50/100 sizes
(default 50). Search/page/size stay in the URL across reload, Back and language changes.
Truck list/details resolve names from a separate reference query and retain original IDs;
failed lookups have their own warning and cannot block truck reads. Every mounted view
owns its captured Apollo client/cache, retired on navigation/language/session/logout.
The upstream version read requires no Karma login; the GraphQL version query still
requires a verified signed admin session. All views support Refresh/retry with retained
previous values on same-query failure.

Concrete history SDL and generated operations expose `karmaTrips`, `karmaEvents` and
nullable `karmaDrivingProfile`. Each validates the signed session first, canonical car
ID and filters, then verifies car existence before fixed GET reads. One four-second
signal covers existence, login/renewal, history and any trip lookahead. Missing cars
produce empty histories or a null profile; business errors remain sanitized errors.
Trips preserve all 23 verified fields, including nullable stop data and raw numeric
active flags; events preserve 12 fields with bracketed selection for `spd`, `odo`,
`edt_tz` and `pdt`. Device strings, code zero, null readings and plain-text extra remain
intact. Runtime checks reject mismatched identity, duplicate/unordered/unsafe IDs,
malformed metrics and event date/type/cursor-bound violations.

History pages return the newest 25/50/100 rows (50 default), current and next cursors,
and `hasMore`, without a total. Trip bounds use `trip_id`; event bounds use `message_id`.
Inclusive `to_id` advances by the last displayed ID minus one, with an initial upper
snapshot. Cursors bind endpoint kind, car, normalized dates/codes and size. Events
read one latest-up-to-500 batch. A short nonempty trip batch performs at most one older
lookahead within the same operation budget, because the provider's trip batch limit
is unspecified; verified older rows enable continuation even below the chosen size.
Terminal empty lookahead disables Older. Trip pages may contain fewer than the selected
size while still allowing Older. No whole-history traversal occurs inside a request.

The separate truck routes `/cars/:recordId/trips`, `/events` and `/driving-profile`
are reached from truck details. Trips/events provide optional paired dates, Latest/
Older/Newer, URL cursor/filter state and full row dialogs with keyboard close and focus
restoration. Events also accept at most 25 original event codes, including zero, and
use explicit UTC filtering. Trip/profile periods are source wall-clock values; their
provider timezone is unspecified and the UI discloses this. Source timestamps are
shown without implicit browser conversion. Profile starts with a seven-day wall-clock
range derived from the current UTC clock and supports replacing/expanding it; the
period aggregate needs no record paginator. Its nine category names, nullable scores
and weights remain original values, without a combined rating or invented scale.

Every mounted history/profile owns a fresh captured Apollo client/cache. Filter/period
or cursor changes cancel obsolete reads and clear old rows/details; same-query Refresh
retains prior successful values on failure. Browser history stores previous cursor
metadata for Newer, while separately opened cursors can use Latest. Truck/language/
session/navigation/logout retire clients. There is no automatic decoding, polling,
map SDK, upstream write or device command in these reads.

The account `accounts` module exposes signed `karmaUsers` and `karmaRoles` fixed GET reads.
User records preserve all eleven source fields: identity/profile text, numeric active flag,
nullable expiry text, role/time-zone/project IDs and the complete ordered project-ID array.
Roles preserve ID and original description; neither response grants permissions or changes
admin authentication. `/karma-client/users` and `/karma-client/roles` are separate menu routes
with complete-list local search and URL q/size/first paging (25/50/100, default 50). Users
have a keyboard-accessible detail dialog showing every source field; null expiry and zero
remain distinct. Same-scope refresh failures retain rows, and session/language/navigation
retirement uses the existing captured client lifecycle. These reads keep the global account
scope and four-second operation bound.
