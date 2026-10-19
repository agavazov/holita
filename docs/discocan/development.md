# Discocan development

Use the [shared development guide](../development.md) for installation, host processes,
environment, database setup, the admin Storybook and Angular agent tools.
The current implementation uses Branch terminology; see [the domain index](README.md#terminology).

## Telemetry admin

Prepare databases, migrate and seed, then run `npm run dev` and open
[Angular admin](http://127.0.0.1:11000). Choose RentalSofia in the Tenant dropdown, then choose a Branch in the second dropdown and sign in to open Vehicles. Login has its own layout without the application topbar/sidebar. Vehicles and Devices are under Fleet; the topbar Branch menu switches the active Branch.
`dev:admin` runs Angular alone when the backends are available. Development defaults to `/bg`;
`/en` selects English. Branch/language/list query survive reloads. Language switching keeps
path/query/hash; Branch switching preserves Vehicles/Devices and resets the list context.

The shell follows the [admin design system](../admin-design-system.md#shell): desktop navigation
collapses to a rail (remembered in `holita.admin.sidebar`), below 1024px navigation opens a modal
drawer, and the topbar stays one row of menus (Branch, language, account with the theme switch
and Sign out) at every width. Resizing preserves drafts and closes obsolete overlays.
Themes persist in `holita.admin.theme`; denied storage displays a status message.

`apps/admin/public/config.json` supplies `graphqlUrl`, optional boolean `fleetEnabled`
and optional `primeUiLicense`. GraphQL may use a root-relative endpoint or an absolute HTTP(S)
URL without credentials/fragment. The development proxy forwards `/graphql` to Gateway.
Startup validates configuration before bootstrap and displays a localized error on failure.
Issued license keys stay private and must not be committed: a developer's key belongs only in the
Git-ignored `apps/admin/public/config.local.json` (`{ "primeUiLicense": "…" }`), which `main.ts`
merges over `config.json` (a 404 or a non-JSON fallback page means none). The production build
excludes `config.local.json`. Browser fixtures replace `config.json` with their own and run
without a PrimeUI key, displaying the "Invalid PrimeUI License" notice
([testing](../testing.md#real-federation-and-browser-smoke-checks)).
`fleetEnabled` defaults true; false hides business navigation and blocks direct routes,
without business requests. Branch discovery stays usable. Backend availability is separately
controlled by `FLEET_ENABLED`; keep the two settings consistent for a disabled installation.

### Demo tenant login

The standalone login screen is shown before login, including on bookmarked business routes.
Selecting a Tenant obtains a candidate demo token and loads only its Branches into the second dropdown.
Changing Tenant clears the Branch selection, cancels its old discovery client and ignores late candidate
tokens. The candidate session is activated and stored only after selecting a valid Branch and submitting
Sign in; no business requests run before this. Login opens Vehicles for the selected Branch. The seed creates the RentalSofia Tenant with Discordia and Sandbox Branches.
Core issues an HMAC-SHA256 token containing Tenant ID and an eight-hour expiry. Core, Fleet and Karma Client
verify it per request and reject missing/invalid/expired sessions as UNAUTHENTICATED. Gateway
forwards Authorization; tenantId never comes from a business input or x-tenant-id header.

Core, Fleet and Karma Client use the same DEMO_AUTH_SECRET (at least 32 characters). Their environment
examples show the local-only default; outside production it is used when no valid secret is set.
DEMO_AUTH_ENABLED=false disables tenant discovery, demoLogin and demo sessions. In NODE_ENV=production
demo auth is disabled unless explicitly enabled and a valid secret is configured. The flag is
for deliberate demonstration deployments only; it does not make this login production-ready.

Angular stores the session in tab-local sessionStorage under holita.admin.demo-session, restores
unexpired sessions and the last selected Branch on reload and clears them on logout/expiry.
The language root redirects signed-in sessions to Vehicles for that Branch (or the first available
Branch if the saved selection no longer exists). There is no Branch list page; the application header
retains the Branch switcher. Saved Branch IDs are checked against current tenant discovery. Denied storage leaves a memory-only
session. Each discovery/business client captures its token and owns its cache. Logout honors
unsaved-form navigation guards. Retired reads stop; submitted writes may finish against their
captured session, without updating another tenant's UI. No server-side revocation exists.

This login has no user verification, passwords, membership checks, roles, login throttling or
audit trail: anyone can select any tenant. Before production, replace public demoLogin/Tenant
discovery with real identity and tenant membership authorization, use secure HttpOnly session
cookies or an appropriate identity-provider flow, and add revocation and required permissions.
The database has mandatory tenant columns, scoped repositories and same-tenant composite keys;
it does not use PostgreSQL RLS. Owning-role/direct SQL access is not tenant-isolated.

### Angular Fleet Vehicles

Routes are `/:language/:branchId/fleet/vehicles`, `/new` and `/:recordId/edit`.
Previous `/reference/vehicles` and `/reference/devices` URLs redirect to `/fleet`, retaining
editor paths, query parameters and fragments. The backend service, subgraph and GraphQL contracts use Fleet names.
Fields are required License Plate (32 characters) and optional multiline Notes (2000 characters).
Blank Notes clear to null. License Plate is not unique. Lists offer URL-backed search/sort/paging,
confirmed single/page-local sequential deletion, partial result feedback and failed-row retry.
Deleting an assigned Vehicle fails without deleting its Devices.

### Angular Fleet Devices

Routes mirror Vehicles under `/fleet/devices`. IMEI is a required string of exactly 15 digits,
unique within a Tenant/Branch; leading zeros are preserved. Truck is a required same-tenant/same-branch Vehicle selected
through a remote search/paging dialog. Several Devices may share a Truck. Create/update validates
assignment scope, and the database protects it with a composite foreign key.

Both modules use typed Reactive Forms, dirty guards, retained failed drafts and focused field errors.
Clients/caches belong to mounted session/Branch/language views. Navigation cancels reads and stops unsent
batch deletes; submitted writes finish in their captured scope without obsolete UI callbacks.

## Admin translations

Bundled Bulgarian/English catalogs supply shell, forms, confirmations and startup text.
Document language follows the route. Apollo clients capture `Accept-Language`; submitted
writes keep their initiating session/Branch/language. Record content/backend messages display as received.

## GraphQL usage

Regenerate and restart after SDL/operation changes. Discover tenants through Gateway with `{ tenants { id name } }`, call `demoLogin(tenantId: "01000000-0000-4000-8000-000000000001") { token tenant { id name } }`, then send the returned token as `Authorization: Bearer <token>` for `{ branches { id name } }` and every business request. Fleet requests require `x-branch-id`; the seeded Discordia Branch is
`10000000-0000-4000-8000-000000000001`. For example:

```graphql
query VehiclesWithBranches {
  fleetVehicles(offset: 0, limit: 20) {
    items {
      id
      licensePlate
      notes
      branch {
        id
        name
      }
    }
    total
  }
}
```

Every Fleet list takes the same [standard list arguments](architecture.md#standard-list-contract).
A filtered, sorted page of active or in-workshop tractors without a group, searched by two
tokens, with stored group/driver references:

```graphql
query TractorsWithoutGroup {
  fleetVehicles(
    search: "CB AX"
    filter: { statuses: [ACTIVE, IN_WORKSHOP], vehicleTypes: [TRACTOR], hasGroup: false }
    sort: { field: FLEET_NUMBER, direction: ASC }
    limit: 50
  ) {
    items {
      id
      licensePlate
      fleetNumber
      status
      currentDriver {
        id
        firstName
        lastName
      }
      deviceCount
    }
    total
  }
}
```

Drivers whose licence or tachograph card expires within 30 days of the Europe/Sofia business
date (expired ones included), with their document status and current vehicles:

```graphql
query ExpiringDriverDocuments {
  fleetDrivers(filter: { documentsExpireWithinDays: 30, statuses: [ACTIVE, ON_LEAVE] }) {
    items {
      id
      firstName
      lastName
      licenseExpiresOn
      tachographCardExpiresOn
      documentStatus
      vehicles {
        id
        licensePlate
      }
    }
    total
  }
}
```

Vehicles with open alerts, their latest state against the Branch data clock and the next
planned service, followed by the alert inbox counts for the same search:

```graphql
query VehiclesNeedingAttention {
  fleetDataClock {
    asOf
    businessDate
  }
  fleetVehicles(filter: { hasOpenAlerts: true }, sort: { field: LICENSE_PLATE, direction: ASC }) {
    items {
      licensePlate
      openAlertCount
      state {
        activity
        lastReportedAt
        fuelLevelPct
        fuelStatus
        odometerKm
        odometerSource
      }
      nextService {
        serviceType
        dueOn
        urgency
        remainingDays
        remainingKm
      }
    }
    total
  }
  fleetAlertCounts(search: "CB 10") {
    open
    openCritical
    acknowledged
    resolved
  }
}
```

Alert transitions state the status the operator saw. A second acknowledgement of the same alert
returns CONFLICT "The alert changed after it was loaded; reload it."; reload and retry:

```graphql
mutation AcknowledgeAlert($id: ID!) {
  acknowledgeFleetAlert(id: $id, input: { expectedStatus: OPEN, remark: "Разговор с водача" }) {
    id
    alertStatus
    acknowledgedAt
    remark
  }
}
```

Completing a service task and scheduling the next one in the same transaction:

```graphql
mutation CompleteService($id: ID!) {
  completeFleetServiceTask(
    id: $id
    input: {
      completedOn: "2026-10-18"
      completedOdometerKm: 412000
      costCents: 48000
      nextDueOn: "2027-04-18"
      nextDueOdometerKm: 442000
    }
  ) {
    completed {
      status
      completedOn
    }
    next {
      id
      dueOn
      dueOdometerKm
      urgency
    }
  }
}
```

Mutations create/update/delete FleetVehicle, FleetDevice, FleetDriver and FleetVehicleGroup;
`deactivateFleetVehicle(id:)` sets a vehicle `INACTIVE` and clears its driver when devices or
history block deletion. `recordFleetOdometerReading` stores an operator odometer reading;
status samples, trips and events have no create API. Inputs never accept tenantId or
branchId; `Date` inputs are
`YYYY-MM-DD` and `DateTime` inputs need `Z` or an offset. Duplicate values and related IDs
outside the Branch return BAD_USER_INPUT with `fieldErrors` (for example
`[{ path: "employeeNumber", message: "Employee number is already used in this branch." }]`).
[Architecture](architecture.md#graphql-contracts-and-context) describes
validation, federation and error semantics. Inspect GraphQL errors even on HTTP 200 and
preserve the response request ID when reporting failures. Branch scope is not authorization.

## Karma Client

### Configuration and access

The independent Karma Client backend listens on loopback port 11014 and starts with `npm run dev`.
Use `npm run dev:karma-client` to start it alone. Use the Karma Client and shared demo entries
from the [single root environment reference](../../.env.example) in the ignored
`apps/karma-client/.env`, or supply them through the process environment. Obtain the shared
account's `KARMA_USER` and `KARMA_PASSWORD` from the
[local credential store](../development.md#local-contributor-instructions-and-credentials).
`KARMA_API_URL` defaults to `https://karma.online/apiv2/`. URLs must have HTTP(S) schemes and
no embedded credentials, query or fragment. Redirects are rejected. Missing/invalid connection
configuration leaves health usable and returns sanitized errors for Karma queries.

Match Core's `DEMO_AUTH_SECRET` and `DEMO_AUTH_ENABLED` settings; this uses the same development-only
signed session protocol as Fleet. Gateway's optional `KARMA_CLIENT_GRAPHQL_URL` defaults to
`http://127.0.0.1:11014/graphql`. Regenerate contracts and restart after SDL changes.

### Admin truck data

After signing in, open **Karma Client → Trucks** (Bulgarian: **Камиони**) or visit
`/en/karma-client/cars` or `/bg/karma-client/cars`. Every authenticated Tenant/Branch sees all
cars returned by the configured account. The list has no Branch filter and is independent
of `fleetEnabled`. The table loads on entry and with Refresh, retaining the previous list
if refresh fails. Click a registration number to open `/en/karma-client/cars/:recordId` or
`/bg/karma-client/cars/:recordId`. Details load independently of the list and show the car
fields, subtype, timezone ID and assigned-driver count. Refresh retains prior details on
failure; missing/invalid IDs show a not-found message. There is no editing, automatic polling,
persistence or Fleet synchronization.

From truck details, open **eData** at `/en/karma-client/cars/:recordId/edata` (or `/bg/…`).
It starts with the latest 50 messages without a date requirement. Apply a page size of
25/50/100, optional paired UTC date/time bounds, or up to 25 comma-separated parameter IDs.
The dates are UTC even though the browser input uses a local-date control. Older/Newer
browse a snapshot; Latest starts again with the newest matching messages. The API supplies
no total. View opens all message fields and parameter readings/descriptions, preserving
unknown IDs and zero values. `spd`, `odo` and `pdt` display their original values without
unverified units or timezone labels.

Filters and current cursor survive reload and language switching in the URL. Newer uses
cursor metadata in the current browser history; a copied older-page URL or language change
may have no earlier trail, so use Latest to restart. Refresh failures retain the current
page; changing page/filter clears its previous rows. Truck validation, independent Branch/Fleet
access and client retirement are the same as for details.

### GraphQL through Gateway

Send requests to `http://127.0.0.1:11010/graphql` with the admin signed session in
`Authorization: Bearer <token>`. This token comes from Core demo login and differs from
Karma's upstream `session_id`. No Branch header is needed. Check the GraphQL `errors` array,
including when HTTP status is 200. Execute one operation at a time, or select its
`operationName` in the JSON request body; `KarmaTruck` also needs `variables: {id: "<car ID>"}`.

```graphql
query KarmaTrucks {
  karmaCars {
    id
    carNumber
    deviceId
    projectId
    carType
    carYear
    carColor
  }
}

query KarmaTruck($id: ID!) {
  karmaCar(id: $id) {
    id
    carNumber
    deviceId
    projectId
    carType
    subType
    carYear
    carColor
    timeZoneId
    driverCount
  }
}
```

Use an ID returned by `karmaCars` as the detail query variable. IDs must be canonical positive
safe integers, represented as strings; malformed IDs produce `BAD_USER_INPUT`. A missing
truck produces `karmaCar: null`. Anonymous/invalid admin sessions produce `UNAUTHENTICATED`
before any upstream request; external failures produce sanitized `SERVICE_UNAVAILABLE`.

| GraphQL field        | Upstream field         | Interpretation                                                                                   |
| -------------------- | ---------------------- | ------------------------------------------------------------------------------------------------ |
| `id`                 | `car_id`               | Numeric car ID normalized to a string.                                                           |
| `deviceId`           | `device_id`            | Original string, including leading zeros.                                                        |
| `projectId`          | `project_id`           | Numeric project ID normalized to a string.                                                       |
| `carNumber`          | `car_number`           | Registration number.                                                                             |
| `carType`, `subType` | `car_type`, `sub_type` | Nullable original strings.                                                                       |
| `carYear`            | `car_year`             | Nullable string; numeric years are normalized to text.                                           |
| `carColor`           | `car_color`            | Nullable original string.                                                                        |
| `timeZoneId`         | `time_zone`            | Nullable numeric ID, resolved through the separate time-zone query.                              |
| `driverCount`        | `driver_ids`           | Array length; empty array is zero, absent/null value is null. Driver identities are not exposed. |

The generated API exposes all these fields. The list requests its eight table fields including time-zone ID;
details request all ten. Project/time-zone names load from a separate reference query;
optional SIM/video content is not included. Upstream account credentials and the Karma session remain server-side.

### Upstream REST connection

The external API base is `https://karma.online/apiv2/` (or configured `KARMA_API_URL`).
The server submits JSON `{user, password}` to `POST /login`, reads `session_id`, then supplies
it as the `karma_sid` query parameter for `GET /cars` and `GET /cars/{id}`. Detail responses
are arrays: one record becomes a truck, an empty array or HTTP 404 becomes null; mismatched
IDs/multiple records are rejected. The client does not expose arbitrary upstream endpoints.

A successful HTTP response can still contain `{error: "Not logged in"}`. This and HTTP 401
trigger one session renewal; other non-success HTTP bodies are cancelled without JSON parsing.
The complete login/read/retry operation has a four-second bound. Credentials, session IDs and
URLs containing them must not be logged or stored in fixtures/documentation. Use the ignored
service environment for credentials, rather than placing them in shell commands.

For eData, execute the generated `AdminKarmaEdata` operation or a query with this input:

```graphql
query KarmaMessages($input: KarmaEdataInput!) {
  karmaEdata(input: $input) {
    cursor
    nextCursor
    hasMore
    items {
      id
      carId
      deviceId
      carNumber
      eventTimeUtc
      eventTimeLocal
      pdt
      spd
      odo
      latitude
      longitude
      parameters {
        id
        value
        description
      }
    }
  }
}
```

Start with `variables: {input: {carId: "<car ID>", pageSize: 50}}`. For older messages,
reuse `nextCursor` with the same truck, page size, dates and parameter IDs. Reuse `cursor`
to reread the current snapshot page. Date strings use `YYYY-MM-DDTHH:mm:ssZ`; supply both
`fromDate` and `toDate`, or neither. `parameterIds` is an array of positive ID strings.

### Location and account references

All queries below require the signed admin token through Gateway and use no Branch header.

```graphql
query KarmaReferences {
  karmaProjects {
    id
    name
  }
  karmaTimeZones {
    id
    name
  }
  karmaVersion {
    version
  }
}
query KarmaLastLocation($carId: ID!) {
  karmaLocation(carId: $carId) {
    carId
    deviceId
    carNumber
    messageId
    eventId
    edt
    edtTz
    pdt
    latitude
    longitude
    spd
    odo
    extra
  }
}
```

Projects map `project_id`/`name` to string `id`/`name`; time zones map `zone_id`/
`zone_name` to nonnegative GraphQL Int `id`/`name`. IDs are unique within each list.
Version maps the nonempty upstream `version` string and does not authenticate upstream.
Location maps `carnumber`, `message_id`, `eid`, `edt_tz` to `carNumber`, `messageId`,
`eventId`, `edtTz`; remaining field names are explicit in the query. Message/event IDs
are nullable strings, timestamps/metrics/coordinates/extra nullable, car/device/
registration required. Missing car/empty location returns null; null coordinates
remain distinct from zero. Do not infer units, exact time meanings or online status.

Open `/bg/karma-client/cars/<car ID>/location` (or `/en/...`) from truck details.
Account routes are `/projects`, `/time-zones`, `/api-info` relative to the same section.
Reference list query parameters: `q` (literal case-insensitive name/ID search),
`size=25|50|100` (50 default), `first` (zero-based row offset, aligned to size).
Both references are complete bounded read responses; pagination is local and the total
is their actual array length. A bookmarked offset is preserved until data arrives,
then clamped to the last matching page if necessary. No historical location paging is
implied: Location displays the last-known message; eData provides message history.

### Trips, events and driving profile

From truck details, open **Trips**, **Events** or **Driving profile** at
`/bg/karma-client/cars/<car ID>/trips`, `/events` or `/driving-profile`; English uses `/en`.
Trips/events start without required dates at 50 records, with 25/50/100 sizes. Optional
paired periods reset the cursor; events also accepts up to 25 comma-separated original
codes, including zero. Trip date inputs use API wall-clock values with an unspecified
provider timezone; event filter dates use UTC. Histories show newest IDs first, full
row dialogs and Latest/Older/Newer without an invented total. Trip batches may be short
with continuation; a bounded lookahead checks this. Newer restores browser-history
cursor metadata; a separately opened cursor URL can still use Latest.

Profile starts with a seven-day period derived from the current UTC clock as API
wall-clock values; no timezone conversion is asserted. Edit both bounds to expand or
replace it, or select Last seven days to reset. It is an aggregate with nine source
category names and nullable score/weight values. Zero and absent measurements remain
distinct, and no combined score or quality threshold is invented.

Generated `AdminKarmaTrips`, `AdminKarmaEvents` and `AdminKarmaDrivingProfile` operations
use these fixed signed-session queries, without an upstream session or Branch argument:

```graphql
query KarmaHistories(
  $trips: KarmaTripsInput!
  $events: KarmaEventsInput!
  $profile: KarmaDrivingProfileInput!
) {
  karmaTrips(input: $trips) {
    cursor
    nextCursor
    hasMore
    items {
      id
      carId
      startDate
      stopDate
      tripDistance
    }
  }
  karmaEvents(input: $events) {
    cursor
    nextCursor
    hasMore
    items {
      id
      carId
      eventId
      edt
      edtTz
      pdt
      spd
      odo
      extra
    }
  }
  karmaDrivingProfile(input: $profile) {
    carId
    carNumber
    deviceId
    categories {
      name
      score
      weight
    }
  }
}
```

Trips/events inputs: canonical `carId`, `pageSize` (default 50), optional `cursor` and
paired `fromDate`/`toDate`. Events adds `eventTypes: [ID!]`. Event dates use exact
`YYYY-MM-DDTHH:mm:ssZ`; trip/profile dates use `YYYY-MM-DDTHH:mm:ss` source wall-clock
strings. Profile requires both bounds. IDs remain strings for safe values above
GraphQL Int; cursors bind endpoint/truck/size/period/codes/snapshot. The server validates
car existence and rejects malformed upstream data within the existing four-second
budget. Profile missing/empty is null; missing cars yield empty histories. Errors are
sanitized, while same-query Refresh retains prior successful data.

View exposes 23 trip fields and 12 event fields, including explicitly selected `spd`,
`odo`, `edt_tz`, `pdt`. `extra` is escaped plain text with preserved whitespace.
Original metric names/values remain visible because units, code meanings, score scales
and active-trip semantics are unverified. Navigation, period/filter/cursor changes,
truck/language/session/logout retire obsolete reads. No upstream decoding, polling,
writes or commands are performed.

Authenticated account views are also available at `/:language/karma-client/users` and
`/:language/karma-client/roles` through the **Users** / **Roles** menu entries. Both fetch
the complete account arrays, support local search and 25/50/100 paging (50 by default),
and retain `q`, `size` and `first` in the URL. User detail displays all eleven upstream
fields, including the original numeric active value, nullable expiry text and project-ID
array. Role descriptions are original data, not an admin permission matrix.

```graphql
query KarmaAccountViews {
  karmaUsers {
    id
    userName
    active
    expireDate
    roleId
    firstName
    lastName
    timeZoneId
    email
    projectId
    projectIds
  }
  karmaRoles {
    id
    description
  }
}
```

These queries use the existing signed Gateway session, never browser-held Karma credentials
or a Branch header. Source expiry timezone/active semantics and role permissions are not
interpreted. Drivers, populated sensors, device configuration, queue and accident reports
have no implemented views because their populated schemas or valid identifiers are unavailable.
