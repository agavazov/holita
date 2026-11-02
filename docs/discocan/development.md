# Discocan development

Use the [shared development guide](../development.md) for installation, host processes,
environment, database setup, the admin Storybook and Angular agent tools.
The current implementation uses Branch terminology; see [the domain index](README.md#terminology).

## Telemetry admin

Prepare databases, migrate and seed, then run `npm run dev` and open
[Angular admin](http://127.0.0.1:11000). Choose RentalSofia in the Tenant dropdown, then choose a Branch in the second dropdown and sign in to open Overview. Login has its own layout without the application topbar/sidebar. Fleet navigation opens Overview, Vehicles, Devices, Drivers, Trips, Alerts, Maintenance, Vehicle groups and General settings; the topbar Branch menu switches the active Branch.
`dev:admin` runs Angular alone when the backends are available. Development defaults to `/bg`;
`/en` selects English. Branch/language/list query survive reloads. Language switching keeps
path/query/hash; Branch switching returns to the current Fleet section's list or Overview and
clears record, filter, paging and fragment context. Vehicle groups and General settings stay
in their selected Settings section on a Branch switch.

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
([testing](../testing.md#browser-smoke)).
`fleetEnabled` defaults true; false hides business navigation and blocks direct routes,
without business requests. Branch discovery stays usable. Backend availability is separately
controlled by `FLEET_ENABLED`; keep the two settings consistent for a disabled installation.

### Demo tenant login

The standalone login screen is shown before login, including on bookmarked business routes.
Selecting a Tenant obtains a candidate demo token and loads only its Branches into the second dropdown.
Changing Tenant clears the Branch selection, cancels its old discovery client and ignores late candidate
tokens. The candidate session is activated and stored only after selecting a valid Branch and submitting
Sign in; no business requests run before this. Login opens Overview for the selected Branch. The seed creates the RentalSofia Tenant with Discordia and Sandbox Branches.
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
The language root redirects signed-in sessions to Overview for that Branch (or the first available
Branch if the saved selection no longer exists). There is no Branch list page; the application header
retains the Branch switcher. Saved Branch IDs are checked against current tenant discovery. Denied storage leaves a memory-only
session. Each discovery/business client captures its token and owns its cache. Logout honors
unsaved-form navigation guards. Editors block navigation while a submitted save is pending and
disable Cancel/Close until it settles. Retired reads stop; a forcibly retired write may finish
against its captured session, without updating another tenant's UI. No server-side revocation exists.

This login has no user verification, passwords, membership checks, roles, login throttling or
audit trail: anyone can select any tenant. Before production, replace public demoLogin/Tenant
discovery with real identity and tenant membership authorization, use secure HttpOnly session
cookies or an appropriate identity-provider flow, and add revocation and required permissions.
The database has mandatory tenant columns, scoped repositories and same-tenant composite keys;
it does not use PostgreSQL RLS. Owning-role/direct SQL access is not tenant-isolated.

### Fleet demo data

The optional `npm run db:seed:fleet-demo` command runs from the repository root. First follow
the shared database setup/migration/seed steps, so Core contains RentalSofia and its Discordia
Branch, and start local Core (`npm run dev:core` or the development group). The CLI verifies
that Branch through Core before writing. It uses `FLEET_DATABASE_URL`, `CORE_GRAPHQL_URL` and
the same `DEMO_AUTH_SECRET` as Core; export non-default values in the invoking shell. Its
root entry point loads root `.env`, rather than Fleet's workspace `.env`.

```bash
npm run db:seed:fleet-demo
```

This inserts missing synthetic Discordia groups, drivers, vehicles, devices, service tasks,
trips, samples and events. It preserves existing records, edits and workflow transitions;
natural-key or reserved-ID conflicts fail explicitly. Activity batches read existing IDs in
the demo Tenant/Branch and insert only missing rows, retaining duplicate protection for
concurrent inserts. Reruns fill gaps from partial activity inserts without replacing the
original clock sample. The default anchor is
`2026-10-18T06:30:00.000Z`, independent of the execution date. An explicit anchor uses
`npm run db:seed:fleet-demo -- --as-of=2026-10-18T06:30:00.000Z`; reruns must use the same
anchor once its clock sample exists. The CLI refuses production mode, future anchors, remote
Core/database URLs and database scopes outside local development or a guarded isolated test
schema. It creates stored demo data; it does not connect a telemetry provider or send device commands.

### Angular Fleet runtime

The connected screens use the same views and drawers as Storybook, with concrete feature APIs
and generated operations through Gateway. `FleetWorkspace` mounts each section for one
session/Branch/language scope. Its captured `FleetPreferences` read must succeed before business
views mount; failure exposes Retry, and unknown or disabled Branches issue no preferences or
business queries. Routed record drawers keep their parent list mounted and use
their own captured client. Closing a drawer preserves its list query and fragment. Browser
Back and direct bookmarks follow the same routes and dirty guards.

Lists persist applied search, independent AND filter conditions, sort, page and page size in
the URL. Search applies after 300 ms, with at most five words and 200 Unicode code points.
Changing a query retires its old read and selection; a failed refresh of the same query keeps
the last rows. Full relation choices load with bounded pages, rather than treating the first
page as the complete Branch. Loading, unavailable data and missing records remain explicit.
All displayed activity, alert, odometer and urgency classifications come from Fleet; a missing
telemetry clock stays unknown. Instant filters use the configured Branch calendar zone, while
service dates remain `YYYY-MM-DD` calendar values.

### Angular Fleet Vehicles

Routes are `/:language/:branchId/fleet/vehicles`, `/new` and `/:recordId/edit`.
Previous `/reference/vehicles` and `/reference/devices` URLs redirect to `/fleet`, retaining
editor paths, query parameters and fragments. The backend service, subgraph and GraphQL contracts use Fleet names.
The list uses the shared Storybook presentation with real GraphQL data: server-derived activity,
fuel freshness, driver/group labels, odometer and whole-Branch KPIs. The displayed data time is
the backend clock; a missing clock remains unknown. Search applies after 300 ms and at most five
words. AND filter conditions, sort, page and page size stay in the URL; created-date filters use
the configured Branch's calendar dates.

New vehicle and a row's Edit action open routed drawers over the retained list. The typed form
edits required License Plate (32 Unicode code points), fleet number, VIN, type, make/model/year,
fuel type/tank capacity, status, group, current driver and multiline Notes (2000 code points).
Optional empty fields clear to null; License Plate is not unique. The drawer loads group/driver
choices through its own scoped client, excludes inactive drivers except the current assignment,
retains failed drafts and preserves list query/fragment on close.

Open profile navigates to `/fleet/vehicles/:recordId/overview`. The `overview`, `trips`, `alerts`
and `service` tabs retain the vehicle profile and independently page related real records.
Edit reuses `VehicleEditorPage`; Record odometer opens the profile's `odometer` child drawer.
Both return to the current tab. A manual reading preserves zero, source and recorded time; it
does not invent device activity, advance the telemetry data clock or change service history.

Delete and Deactivate use the same IDs-array mutation from a row or the selection. Delete asks
for confirmation and preserves protected Vehicle failures without deleting related Devices.
One toast reports successes and partial/error details; failed selections remain for retry.

### Angular Fleet Devices

The `/fleet/devices` runtime mounts `DevicesPage` from `devices-list-page.ts`, with routed
`DeviceEditorPage` children at `new` and `:recordId/edit`, and `DeviceDiagnosticsPage` at
`:recordId/diagnostics`. IMEI is a required 15-digit string, unique within a Tenant/Branch;
leading zeros are preserved. Vehicle assignment is optional: clearing it stores `null` and
shows the device as in stock. Several devices may share a vehicle. The editor loads all
Branch vehicle choices with bounded pages and edits model/options, firmware, SIM fields,
installation time with an explicit offset, and notes. Assignment validation and the composite
foreign key preserve Tenant/Branch scope.

The primary IMEI action opens the read-only Diagnostics drawer. Its Edit action opens the
existing editor and returns to Diagnostics on save or cancel; direct row-menu Edit keeps its
list return. The bounded `editFrom=diagnostics` query marker preserves that return after reload.

Whole-Branch online/offline/in-stock KPIs and last report come from Fleet. Firmware policy,
hardware signal/voltage and restart are unavailable in the connected runtime; no provider
command or success is simulated. Diagnostics shows the actual stored metadata and labels
unsupported readings explicitly. The separately labelled Storybook Demo can illustrate those
sample interactions. Runtime Delete uses one IDs-array mutation with per-ID failures and
retains failed selections for retry.

### Angular Fleet monitoring and Drivers

`/fleet/overview` loads the Branch overview, daily distance, activity by group, recent trips
and attention links through `OverviewApi`. It preserves unknown telemetry and retains the
previous overview on a failed refresh. Login, the language root and `/:language/:branchId/fleet`
open Overview; an unrecognized current section also falls back to Overview on Branch switching.

`/fleet/alerts` opens actual actionable events, server counts and clock; `:recordId` opens
`AlertDetailPage`. Acknowledge uses one optimistic `expectedStatus: OPEN` batch. Resolve and
reopen use the status actually loaded in the drawer, retaining a rejected remark draft on
conflict. Count KPIs ignore status/actionable selections but keep other filters and search;
the resolved footnote describes the current filters, rather than an invented time window.

`/fleet/trips` and its `:recordId` detail use `TripsPage` and `TripDetailPage`. The drawer shows
the full returned driving-event timeline. Whole-Branch summary and filtered distance total
stay separate. An unknown duration or end time remains unknown; duration seconds are converted
to minutes for presentation.

`/fleet/drivers` uses `DriversPage` and a routed `DriverEditorPage` for `new`, `:recordId` and
`:recordId/edit`. Read/Edit/Cancel navigation retains the parent list. The form edits contact,
identification and document fields with explicit null clearing. The `:recordId/scorecard`
page loads the actual 7/30/90-day scorecard with `days` in the URL and preserves list context
on return; no telemetry shows its own empty state. Assigned-driver deletion stays protected.

### Angular Fleet Maintenance and Vehicle groups

`/fleet/maintenance` mounts `MaintenancePage`; `MaintenanceRecordPage` dispatches `new`,
`:recordId/edit`, `:recordId` and `:recordId/complete` to the shared task or completion drawer.
Only planned records are editable; DONE receipts and CANCELLED plans are read-only. Completion
uses Fleet's business date and can atomically plan the next occurrence. An inactive vehicle
can receive a historical completion but cannot receive next planning. A service odometer is
separate from telemetry; the server enforces its earlier-service floor. Costs are exact EUR
cents, including zero, and filter controls reject fractional cents. Untitled task filters
also match the active catalog's service-type labels. Cancel/Delete use real batch results.

`/fleet/settings/groups` uses `VehicleGroupsPage` and `VehicleGroupEditorPage` at `new` and
`:recordId/edit`. It loads the complete paged group list before local presentation paging,
including real vehicle and ungrouped counts. Delete is a single-record operation and cannot
remove a group that still contains vehicles.

### Angular Fleet General settings

`/fleet/settings/general` mounts `GeneralSettingsPage` and the shared full-page
`GeneralSettingsView`. It edits the Core Branch name plus Fleet time zone, distance/volume
display units, low-fuel percentage, not-reporting hours and the stored speed-limit reference.
Fleet validates the four supported regional zones, KM/MI and LITRE/US_GALLON choices, and
integer bounds of 1–50%, 1–168 hours and 30–130 km/h. A Branch without stored preferences
receives Sofia/KM/LITRE/12/48/90 defaults from Fleet.

Saved units convert read values and chart labels to km/mi, km/h/mph and litres/US gallons.
Stored API measurements remain canonical; typed editors and filters keep their explicitly
labelled km, km/h and litre entry units to preserve precision and contract bounds. Displayed
instants use the Branch zone; calendar filters and backend daily/business-date rules use it
as well. Date-only service/document values are not converted between zones. Editors with a
specific entry-zone hint, such as the Sofia odometer input, retain that labelled zone.
Low-fuel/reporting thresholds affect server-derived facts and counts. The speed limit is a
stored reference only; saving it does not generate or rewrite historical speeding alerts.

Save writes Fleet preferences first and renames the Core Branch only when its trimmed name
changed. There is no cross-service transaction. A Fleet failure leaves both pending drafts
unchanged. If Fleet succeeds but the name fails, the saved preferences apply immediately,
the name stays editable with field/error feedback, and a sticky warning reports partial
success. Discard restores the actual persisted Fleet settings and original Branch name;
retry does not claim an earlier failed rename succeeded. Full success clears the dirty form
and refreshes Branch discovery after a rename. Navigation retires UI callbacks while submitted
writes settle in their captured scope.

Notification switches are disabled and visibly labelled Demo/unavailable in the live page;
they are not sent to either service. No email delivery or notification preferences are
simulated. The shell's Demo bell remains separate from operation toasts.

All editors use typed Reactive Forms, dirty guards, disabled submitted forms, retained drafts
and mapped field errors with focus. Navigation cancels obsolete reads and confirmations.
Submitted writes, including Vehicles/Devices/Drivers/Alerts/Maintenance batches, settle against
their initiating session/Branch/language client. Successful IDs leave the selection; failed
IDs remain available for retry. Retired callbacks cannot refresh or notify a new workspace.
One `OperationToast` and `MessageService` in `AdminWorkspace` owns operation feedback; load and
field errors stay inline.

## Admin translations

Bundled Bulgarian/English catalogs supply shell, forms, confirmations, startup text and every
connected Fleet screen, including profile/odometer, scorecard and both settings views.
`apps/admin/src/app/i18n/messages.spec.ts` checks key and placeholder parity for every catalog
pair.
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

Drivers whose licence or tachograph card expires within 30 days of the configured Branch business
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
if refresh fails. Search by registration, car ID or device ID and optionally select a project;
filtering and 25/50/100-row pagination use the full loaded account list. Search, project and
page state survive reload and language changes in the URL. Clear filters returns to the first
page. Click a registration number to open `/en/karma-client/cars/:recordId` or
`/bg/karma-client/cars/:recordId`. Overview loads the source-local daily report and an independently
reported last position, followed by the car summary, with subtype, timezone ID, assigned-driver count and every
other original field available in the closed Source fields section. Refresh retains prior details on
failure; missing/invalid IDs show a not-found message. There is no editing, automatic polling,
persistence or Fleet synchronization.

Each truck section has the same registration/ID header and primary Overview, Trips and Location
navigation; More groups Diagnostics, Device settings, eData, Events and Driving profile. Back to trucks restores the originating list
filters/page. Switching sections keeps that list context and a validated selected report day
without copying the section's history date filters or cursor. Invalid submitted date/time ranges and ID lists show errors beside the
relevant fields and focus the first invalid input; malformed URL filters keep their warning.

### Real truck diagnostic history

Open a truck's **More → Diagnostics** at
`/en/karma-client/cars/:recordId/diagnostics` (or `/bg/…`). History reads the configured
Karma account through Gateway independently of the active Branch. It starts with a bounded
latest batch; optional inclusive **From message ID / To message ID** bounds can select an
actual source record without a slow dated scan. Older pages are explicit reads. No total or
complete current ECU fault inventory is implied.

Each report preserves message ID, car/device identity, source UTC time, display timezone,
report family and original payload. `419` type `21` decodes six-byte entries as four-byte
big-endian SPN, FMI and reported status (`01` added, `02` removed). A removed logger entry
does not establish a repaired vehicle. Unsupported or ambiguous layouts, including `418`,
remain inspectable without invented descriptions, ECU identity, severity or current active
status. Tracker diagnostics, OBD reports, communication snapshots and fault reports retain
separate families. Empty loaded history means no report was observed in that selection.

The operator view shows each decoded fault separately with a red reported-fault label and
**View fault** opening its explanation, event time and service follow-up. Removed entries use
a neutral label and do not confirm a repair. Counts describe the displayed historical entries,
not unique active faults. Source IDs, message bounds, original reports and bytes are under
**Technical details**. Unknown codes keep an explicit missing-description notice.
The small description reference covers SPN 4339 (SCR feedback control), SPN 1247 (engine
power) and FMI 7, 11 and 15, using the manufacturer's
[SS1033423 reference](https://static.nhtsa.gov/odi/tsbs/2018/MC-10141869-9999.pdf)
(PDF pages 24, 93 and 394). It supplies general code meanings, not a vehicle-specific diagnosis.

Fixed **Read fault logger** and **Read communication diagnostics** actions require the
active Branch and enabled Fleet device operations, using the same private machine token
and worker setup described [below](#background-device-configuration-reads). No local Fleet
Device registration is needed. Saved operations survive refresh/restart. Queue delivery,
special device acknowledgment and actual returned reports are shown separately.
No outer transport acknowledgment is inferred from them. `154,0` is NACK/error, and
`154,1` is a positive special ACK; neither establishes a complete fault inventory.
Pending/uncertain requests are not automatically replayed. A provider queue still pending
after a local timeout blocks another read, including from another Branch. A terminal
provider result permits a new explicit read. Empty/type-only fault payloads do not complete a read.
The actions do not change configuration or clear faults.

For the verified CB1147TP capture, select car `16595` and bound both message IDs to
`7177124308` to inspect SPN 4339/FMI 7 and SPN 1247/FMI 11. Message `7179721665` contains
SPN 23806/FMI 15. These historical reports prove received faults, not a fresh ECU scan.
The [dated live evidence](erm-resources/erm-support-diagnostics-protocol-test-server/live-verification-2026-10-29.md)
retains the separate logger NACK and queued-request outcomes.

### Truck measurements

From truck details, open **eData** at `/en/karma-client/cars/:recordId/edata` (or `/bg/…`).
It starts with the latest 50 messages without a date requirement. Apply a page size of
25/50/100, optional paired UTC date/time bounds, or up to 25 comma-separated parameter IDs.
The dates are UTC even though the browser input uses a local-date control. Older/Newer
browse a snapshot; Latest starts again with the newest matching messages. The API supplies
no total. View opens a message/time summary and parameter readings/descriptions. The parameter
table wraps long content so IDs and values stay visible within narrow drawers. Source fields
expands all original message fields, preserving
unknown IDs and zero values. `spd`, `odo` and `pdt` display their original values without
unverified units or timezone labels.

Filters and current cursor survive reload and language switching in the URL. Newer uses
cursor metadata in the current browser history; a copied older-page URL or language change
may have no earlier trail, so use Latest to restart. Refresh failures retain the current
page; changing page/filter clears its previous rows. Truck validation, independent Branch/Fleet
access and client retirement are the same as for details.

### Truck daily Overview

Open a truck's **Overview** to load Yesterday in its proved `Europe/Sofia` source zone.
Choose a completed **Source-local day** and **Apply day**, or choose **Yesterday** to let the
server select it again. The selected day stays in `?day=YYYY-MM-DD`, survives switching truck
sections and does not change the independent Trips/Events filter clocks.

The three values are total distance, trip count and maximum trip speed from the same bounded
server result. Distance and speed retain explicitly unconfirmed source units. Day/night
composition appears only for complete compatible inputs. Retrieval, per-value availability and
unassessed GPS coverage remain separate; partial values describe the loaded subset, and a
failed query does not become a zero-trip or example report.

**Loaded trips** pages only that report's returned trips. **View trip** opens the original
record and historical endpoints in a drawer at `#trip-<id>`, preserving the day and originating
truck-list filters. Map and Street View use the selected endpoint; Google directions remain a
suggestion. **Source fields** retains the raw trip record. Close returns focus to the row.
The default **Last reported position** belongs to the latest available message independently
of the selected day; its map pauses while the historical drawer map is active. Missing
coordinates or Google configuration leave readable source facts and valid external actions.

**Compare two days** loads one explicitly selected second completed day through the same bounded
report contract. `?compareDay=YYYY-MM-DD` preserves that selection without reloading the primary
day. The comparison keeps both retrieval times, source-zone boundaries and source trip links.
Differences are selected day minus comparison day, in the displayed source units. Both reports
must be complete (including a completed empty day), with matching truck, zone, selection and
metric units; each value must be available and complete. Percentage change additionally needs
a nonzero comparison value. Partial or unavailable values remain visible with an explanation,
without a difference or a quality assessment.

**Day brief / export** provides deterministic facts and calculation explanations from that
loaded report. Its local JSON download contains the selected day and, only when chosen, the
loaded comparison day. The trip drawer's **Trip and selected point brief / export** downloads
the original trip, bounded position-read metadata and only the selected point, when selected.
The files retain source IDs, raw units, clocks, retrieval/coverage and selection limits. Export
does not request more data or recompute totals from the current table page. Coordinates are
excluded by default and require the explicit checkbox; the latest reported location is not
historical report evidence. Files are downloaded locally with no upload or public sharing.

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
The complete login/read/retry operation normally has a four-second bound. Public eData reads
have an eight-second bound, within Gateway's nine-second Karma subgraph deadline and the
admin's ten-second HTTP deadline. Device command and background observation budgets are separate.
Credentials, session IDs and
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

### Karma maps

The truck inventory's **Location** and **Street View** row actions open a drawer and
load only that truck's last reported position. The selected truck and view stay in
the URL alongside the inventory filters; closing restores the row action's focus.
Overview and Location use the same [shared map panel](../../apps/admin/src/app/ui/map-preview/map-preview.ts)
for the last reported position, separately from a selected historical report day.
Event and eData detail drawers use their own record's coordinates, source time and ID,
without substituting the truck's newer location.
Trip drawers use the panel with the recorded Start/End points. Select **Map** or
**Street View** for a point, or **Suggested Google route** when both endpoints are valid.
With only one valid endpoint, point actions remain available and directions are absent.
The suggested route is Google's calculation between endpoints, not recorded vehicle movement.
Invalid or missing coordinate pairs cannot open a map. Zero is a valid coordinate.

The source record, coordinates and source times remain visible while exploring the map.
Street View shows nearby surroundings that may be older or unavailable, not live vehicle
imagery or the scene at the record's time. It does not change the source point.
**Return to recorded point** restores the point view; external Google Maps actions remain available without a key.

Google Maps links work without application configuration. For an interactive embedded preview,
enable Maps Embed API in a Google Cloud project and add a browser key as
`googleMapsEmbedApiKey` to `apps/admin/public/config.local.json`, preserving any existing
`primeUiLicense`. Production can supply the same property in public `config.json`.
These are browser-visible keys; restrict the key to Maps Embed API and the exact admin website
referrers, including `http://127.0.0.1:11000/*` for local development. Configuration is validated
at bootstrap; reload after changing it. The ignored local file is excluded from production builds.
See Google's [Embed setup](https://developers.google.com/maps/documentation/embed/get-api-key)
and [embedding guide](https://developers.google.com/maps/documentation/embed/embedding-map).
With a configured key and valid coordinates, the active map panel automatically loads
the selected Google view and explains that the coordinates are sent to Google. Selecting
Street View or changing the mode, endpoint or source record updates the preview directly.
Loading is limited to the mounted active panel, without hidden-tab or per-row previews
or polling. Without a configured key, valid external links remain available; missing or
invalid coordinates retain the textual fallback. Coordinate facts and fallback actions
remain visible if a preview or panorama is unavailable; no separate Street View
availability lookup is performed.

Trip drawers also show **Point records** from a single bounded read between the selected
trip's start/end message IDs. Selecting a row updates the shared Map/Street View context;
local paging and point selection do not refetch source data or replace the trip/list URL.
**Return to trip endpoints** restores endpoint mode and its separately labeled suggested
directions. Missing coordinates never borrow another record's point. Empty, partial or failed
sample reads retain the original endpoint facts and report their retrieval state separately
from GPS coverage. Open trips or missing message bounds remain in endpoint mode.

The list keeps same-time/same-coordinate records with distinct IDs. Long intervals use the
displayed Holita 15-minute rule over established UTC positions; this is not a provider
sampling-frequency claim. Declared source gaps are displayed separately. Full paths,
multi-marker fleet maps and nearest-truck lists remain unavailable without the richer-map
and bounded bulk-contract prerequisites; eData/CAN series are not loaded by this view.

The truck list and profile tabs share the admin page, filter and table patterns.
Open an eData message, trip or event from its record link or row menu to view its details
in a right-hand drawer; original fields remain in the expandable Source fields section.
Karma list/search/filter controls share one responsive layout. History range filters use PrimeNG
DatePicker with a separate textual time including seconds, retaining the existing UTC or API
wall-clock interpretation and URL values even during daylight-saving clock gaps. The daily
Overview uses a calendar-date input in its explicitly named source zone.

### Measurements

On the selected truck's eData page, set the existing UTC bounds and optional parameter filter,
then choose **Measurements**. **Source messages** returns to the original message table.
Both views share one bounded API page; Older/Newer replaces that subset. The scope text shows
the requested inclusive bounds, filter, limits and continuation. No full-period total or
per-vehicle hardware capability is inferred from a loaded page.

Choose one channel to see its source-scale chart and readable measurements table. Expand
**Observed channels in the loaded selection** for numeric/null/absent counts and separate
last observed/last numeric timestamps. Not observed does not mean unsupported hardware,
healthy or disconnected. Source-provided unit labels are not independent calibration, so
real counter comparison, engine-counter differences and fuel consumption remain unavailable.

Select a table record for its reading ID, message/position ID, unchanged source time and
Map/Street View. **Open selected source message** reveals the original eData fields. Neither
selection issues another eData request. Unproved UTC clocks keep the table and disable the
chart; nulls, absent readings, declared gaps and the displayed 15-minute rule break its line.
A failed refresh retains the preceding successful retrieval time and data.

### Trips, events and driving profile

From truck details, open **Trips**, **Events** or **Driving profile** at
`/bg/karma-client/cars/<car ID>/trips`, `/events` or `/driving-profile`; English uses `/en`.
Trips/events start without required dates at 50 records, with 25/50/100 sizes. Optional
paired periods reset the cursor; events also accepts up to 25 comma-separated original
codes, including zero. Trip date inputs use API wall-clock values with an unspecified
provider timezone; event filter dates use UTC. Histories show newest IDs first, full
row drawers and Latest/Older/Newer without an invented total. Trip batches may be short
with continuation; a bounded lookahead checks this. Newer restores browser-history
cursor metadata; a separately opened cursor URL can still use Latest.

Profile starts with a seven-day period derived from the current UTC clock as API
wall-clock values; no timezone conversion is asserted. Edit both bounds to expand or
replace it, or select Last seven days to reset. It is an aggregate with nine source
category names and nullable score/weight values. Zero and absent measurements remain
distinct, and no combined score or quality threshold is invented.
The applied API period appears above the category values. Event details show the original code
and escaped source text first. Both views keep their original identity/source fields in a closed
Source fields section, matching truck and eData details.

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
interpreted. Drivers, populated sensors, queue and accident reports
have no implemented views because their populated schemas or valid identifiers are unavailable.

## Background device configuration reads

Apply Fleet migrations with `npm run db:migrate --workspace @holita/fleet` and regenerate
contracts with `npm run codegen`. Configure these entries from the root `.env.example`:

- Fleet: `FLEET_DEVICE_OPERATIONS_ENABLED=true` and `FLEET_KARMA_INTERNAL_URL`, default
  `http://127.0.0.1:11014` without a path, query or embedded credentials.
- Fleet: `FLEET_DEVICE_CONFIGURATION_WRITES_ENABLED=true` additionally enables parameter
  additions, interval changes and single-rule changes. It defaults to `false` and requires background operations
  to be enabled. Import the verified Monitor 9.56 catalog through the
  [local catalog procedure](erm-resources/simple-edata-catalog/README.md) to offer additions;
  interval changes can use captured definitions without a catalog entry.
- Fleet and Karma Client: the same random private `KARMA_INTERNAL_TOKEN`, at least
  32 characters, supplied through their process environment or ignored runtime `.env` files.
- Karma Client: its existing API account settings. Browser/demo tokens are not accepted by
  the internal endpoint, and the machine token must never appear in browser configuration.

Restart both application processes after changing environment configuration. The scheduler
runs inside Fleet; leaving the browser does not stop it, but stopping Fleet pauses processing.
Both flags default to `false`; saved requests and snapshots remain readable when disabled.
Turning off the write flag prevents unsent changes; already marked submissions continue
readback verification while background operations remain enabled. Turning off background
operations stops the worker. Keep the configured Karma account stable while requests are active.

In Karma, open the intended truck and choose **Device settings** at
`/:language/karma-client/cars/:recordId/configuration`. The active Branch in the shell supplies
Fleet scope for operation history. The selected truck's Karma record supplies the device,
shown as **Device in Karma**. No local Device registration, matching or additional selector is
needed. The server verifies the current Karma car/device pair before queuing and dispatching work.
Opening a settings URL while signed out returns to that same route after login and Branch selection.

The page summarizes the device, last successful read, whether commands and changes are enabled,
and pending or failed operations. **Read configuration** reads parameters, then rules after the
first complete response. Opening or reloading the page only loads saved results; it never queues
a device command. **Continue reading rules** resumes an interrupted sequence. Each section shows
its own read time and distinguishes **Not read yet** from a confirmed empty response.

Use one flow: **Read device → Edit → Review difference → Send → Verify result**.
Periodic data lists parameter names, source codes and intervals. **Add parameter** opens a
searchable catalog picker; **Change interval** opens the selected parameter directly. Choose
30 seconds, 1, 5 or 15 minutes, or enter custom whole seconds from `0` to `65000`. A separate
review shows the truck, parameter and before/after interval before sending. Zero means
**Not in use** and requires separate confirmation; readback does not prove measurement silence.
Unknown parameter IDs remain editable from their captured definitions. Changes require the latest
complete read for this exact truck/device and Branch, enabled dispatch and writes, and no pending
or uncertain operation. Refresh the truck and read again if Karma changes its device.

**History** shows the newest requests first, their send times, requested changes and outcomes.
A queued request is not a confirmed change. A successful result requires matching device readback.
Original fields, raw definitions, request IDs and prerequisites are under **Technical details**.
History cannot replace the current editing baseline with an older snapshot.

The parameter row's **Measurements** action opens a read-only drawer for that parameter and
Karma device. It loads the latest records within the displayed 24-hour UTC window on opening
or manual refresh. The drawer keeps the configured interval and its confirmation time separate
from the last source value, source timestamp and differences between recent records. A successful
change can remain configuration-confirmed without new numeric measurements after it. These
differences do not automatically establish periodic reporting: eData can also contain event
or ignition-off reports. An unavailable query is shown separately from an empty result.

Conditional events describe each rule's condition, threshold, confirmation time and event codes
in one sentence. Read both parameters and rules before creating or changing an event. The drawer
walks through **When should it send?** (name, searchable parameters, comparisons and threshold,
confirmation time) and **What should it send?** (event codes when the condition becomes true or
false), then opens the review of one rule. Event names and payload selection are not supplied by
the current API; use event codes established for this truck. Ordinary rules require at least one
reporting transition. Technical details contain the automatically selected free rule number,
explicit replacement controls, calculation-only mode and advanced expression editing.

Advanced ID text preserves complex expressions, including arithmetic, mixed logic and `TimeOf`,
`Count` or `Sum`, without flattening them. Constants are integers from -65535 through 2147483647;
mixed operators require explicit grouping. RuleData is limited to 128 bytes. Confirmation time
is `1..32767` milliseconds, separate from `TimeOf`; no firmware behavior is simulated.
Unsupported device rules stay opaque and cannot be overwritten. Other rules and the observed
dashboard bit are preserved; a new rule uses false for that bit.

Unsent rule changes and local names are retained in this browser for the signed Tenant and truck,
and appear alongside device settings with an explicit unconfirmed status. **Review change** leads
directly to the guarded send review. Missing dependencies, duplicate rule numbers, changed
baselines, pending operations and uncertain outcomes block sending. Discarding a proposed change
never deletes a device rule. Unsubmitted edits guard navigation and target changes.

**Technical details and file tools** contains INI/TXT tools for inspection and local authoring only. Original source, names, section order,
unknown keys and opaque definitions remain available; mismatches, unresolved dependencies and
unsupported expressions are shown. Download the original source, export edited local INI,
or export inspection TXT containing individual `04` records. Edited ID-expression exports
do not claim full Monitor compatibility. Imported parameter/global/profile settings and TXT
commands are never executed. Opaque and n-ary expressions can be inspected/exported unchanged.

For an online change, use **Read configuration** to obtain
both complete snapshots. Choose one editable rule and review the
target, both baselines, dependencies, event IDs, debounce and old/new record before confirming
the single background change. Missing configured dependencies, duplicate local IDs, pending
operations or a changed baseline prevent submission. Raw record bytes and request identifiers
remain available in technical details. Existing device rules with unsupported expressions
cannot be overwritten; their bytes are preserved when another rule changes.

After a matching complete rule readback, the confirmed row keeps its local name and the exact
submitted draft revision is retired. Any later local edits remain a draft. A failed or uncertain
write keeps the revision available until a later read confirms the same target, Rule ID and record.

Fleet rechecks the observed profile for additions and rereads the whole parameter set before
the sole additive write. Every baseline definition must match, and the conservative phase/
response age must remain within 120 seconds. Expired evidence causes a safe fresh read.
The server sends one full 22-byte definition with operation `02`; an interval update changes
only its last two bytes. An independent complete read must verify the intended change and
preserve every other definition before the operation completes. Stored history shows its
kind, phase and uncertainty; it survives navigation, browser reload and Fleet restart.

A rule change similarly rereads both captured parameter and rule sets, requires both within
the 120-second window, and sends exactly one rule record. An independent complete `402` rule
read must match that record and all unrelated rules before completion. The write preserves
an existing rule's dashboard flag; a new device rule uses false. Queue acceptance, generated
bytes or an event occurrence do not establish successful verification or correct runtime behavior.

The ten-minute deadline does not cancel a command in Karma's queue. An uncertain or timed-out
write may arrive later and is never automatically replayed. If a browser request loses its
response, refresh saved operations before submitting again. If verification remains incomplete,
read and reconcile the device state before another change. Parameter values, global settings,
profile changes, deletion, restoration and measurement verification have no automated editor.
Demo login identifies a Tenant, not a named operator or production write permission.
See [operation persistence and evidence limits](architecture.md#background-device-configuration-reads).
