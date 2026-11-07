# Discocan development

Use the [shared development guide](../development.md) for installation, database setup,
environment, host commands, Storybook and Angular agent tools. The
[domain index](README.md#terminology) defines Branch scope.

## Telemetry admin

Prepare databases, migrate/seed and run `npm run dev`; open http://127.0.0.1:11000.
Sign in with your email and password, then choose a fleet to open Dashboard. `/bg` is the default;
`/en` selects English. `npm run dev:admin` runs Angular alone against available backends.
Branch switching keeps the Fleet section and clears record/list context; language switching
preserves path/query/hash. The [design system](../admin-design-system.md#shell) defines shell,
keyboard, theme and responsive behavior.

Public `apps/admin/public/config.json` supplies `graphqlUrl`, optional `fleetEnabled` (default
true) and optional `primeUiLicense`. GraphQL accepts root-relative or HTTP(S) URLs without
credentials/fragments. The development proxy forwards `/graphql` to Router. Invalid startup
configuration shows a localized error. Issued keys belong only in the ignored
`apps/admin/public/config.local.json`, never in Git. Production excludes that file; do not
publish development output or Storybook serving local configuration. See
[shared configuration](../development.md#ports-and-environment) for the environment reference.
Keep `fleetEnabled` and backend `FLEET_ENABLED` consistent when disabling Fleet.

### User sessions

Provision the first user for an existing Tenant using the
[Core setup command](../development.md#core-users-and-sessions) with `--role ADMINISTRATOR`; there is no public registration
or password recovery. Sign-in takes email/password first, then offers that Tenant's Branches.
A single Branch opens automatically; an account with no Branches can open Profile and retry
discovery. Profile edits name/email and changes the password; the admin signs out after a password
change and requires the new password. The account menu also offers theme and Sign out.
Real sessions are saved in localStorage as soon as sign-in succeeds, before fleet selection.
Reloads and new tabs in the same browser stay signed in until expiry or sign-out. Sign-out,
expiry and a detected server revocation clear the real session across tabs; each open tab keeps
its current fleet when another tab changes fleets. Denied storage uses memory only.
Sign-out honors dirty guards and retires clients; submitted writes keep their captured token.

Users is a separate Tenant-wide sidebar destination and requires no Branch. Only Administrators can create users,
edit their accounts or roles, and deactivate/reactivate accounts. Nobody can change their own
role. Deactivation revokes that user's sessions; reactivation requires a fresh sign-in.
Each user has one Tenant-wide role: `VIEWER`, `OPERATOR`, `ENGINEER` or `ADMINISTRATOR`.
Existing accounts become Administrators when the role migration is applied; new accounts default
to Viewer unless a role is supplied. Core exposes `User.role` through `me` and user queries;
`createUser` and `updateUser` accept an optional `role` argument. Profile editing and password
changes remain available to every signed-in user.

In Fleet, Viewers can read data with stored Device SMS passwords returned as null. Operators,
Engineers and Administrators can edit master data, perform batch actions and act on alerts.
Branch settings and Branch renaming require Administrator. Notification read state remains
available to every real user. In ERM every role can read history; Viewers see protected parameter
values masked. Operators and above may queue/cancel/retry device reads, start/stop read batches
and read eData configuration. Engineers and Administrators may capture parameter snapshots and
write configuration, including verified parameter batches and return from Karma. Role refusals
use `FORBIDDEN`; the deployment write switch still applies.

Fleet and ERM accept the bearer returned by Core's `signIn`. Configure `CORE_AUTH_VERIFY_URL`
and the shared `CORE_INTERNAL_AUTH_TOKEN` in both services as described in
[Core users and sessions](../development.md#core-users-and-sessions). Core supplies the verified
Tenant, User and session IDs and the user's role; caller identity headers are ignored. Supply `x-branch-id` for the
selected fleet. Successful verifications are cached for five seconds, including the maximum
delay before revocation or a role change takes effect in Fleet/ERM; failed verifications are not cached.
An unavailable Core verification service returns `SERVICE_UNAVAILABLE`, while an invalid session
returns `UNAUTHENTICATED`. Permission refusals use `FORBIDDEN`.
For authenticated internal callers, Core's verification endpoint returns HTTP 200 with the
identity (including `role`), or `{ "authenticated": false }` for an invalid/revoked session.
Non-success responses mean verification is unavailable to Fleet and ERM.

### Demo tenant login

Development builds expose **Development demo login** separately from email/password sign-in.
Choose an organization, select **Continue with demo**, then choose a fleet and **Open Dashboard**.
Tenant selection obtains a candidate token and loads that Tenant's Branches. The session
starts only after a valid Branch is selected. Core issues an
HMAC-SHA256 session with an eight-hour expiry; all subgraphs independently verify it.
Authenticated requests carry `Authorization: Bearer <session>`; Fleet also needs `x-branch-id`.
A caller-supplied tenant header never selects identity. Demo Tenant sessions act as `ADMINISTRATOR`.

Core, Fleet and ERM API use the same `DEMO_AUTH_SECRET` (at least 32 characters).
`DEMO_AUTH_ENABLED=false` disables demo discovery/login/sessions; real user sessions remain
available. Production requires explicit demo enablement and a valid secret. This development
login deliberately permits anyone to choose any Tenant; use real user sessions for client access.

Tab sessionStorage retains the unexpired demo session and selected Branch. Demo tokens have no
server-side revocation. A rejected real session never falls back to this demo flow.

### Fleet demo data

After shared setup/migrate/seed, start Core and run `npm run db:seed:fleet-demo`. The command
loads root `.env` and uses `FLEET_DATABASE_URL`, `CORE_GRAPHQL_URL` and `DEMO_AUTH_SECRET`.
It verifies Discordia through Core and inserts missing synthetic records without overwriting
edits or workflow transitions. Natural-key/reserved-ID conflicts fail explicitly.
The fixed anchor defaults to `2026-10-18T06:30:00.000Z`; override with
`npm run db:seed:fleet-demo -- --as-of=2026-10-18T06:30:00.000Z` and retain that anchor on reruns.
Production, future anchors, remote targets and unguarded database scopes are refused.
This creates demo data, not telemetry or device commands.

### Fleet operator workflows

All paths below start with `/:language/:branchId`. Lists retain search, AND conditions, sort
and paging in the URL. Search applies after 300 ms, within 200 code points/five words.
Drawers retain lists and return context; failed saves retain drafts. Dirty forms ask before
leaving; submitted forms lock until settlement. Only successful batch IDs leave selection.
Server-derived facts and clocks remain unknown when data is absent.

| Destination                 | Operator workflow                                                                                                                                                                                                                                                                                            |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `/fleet/dashboard/overview` | Whole-Branch KPIs, complete paged fleet map, attention links, charts and filtered drill-downs                                                                                                                                                                                                                |
| `/fleet/dashboard/problems` | Alerts, recorded device evidence, reporting gaps and failed/uncertain commands; only alerts allow acknowledge/resolve/reopen                                                                                                                                                                                 |
| `/fleet/dashboard/trips`    | Scoped trip detail and complete maneuver timeline; filtered distance and whole-Branch summary remain separate                                                                                                                                                                                                |
| `/fleet/vehicles`           | Create/edit master data, delete/deactivate; detail tabs `overview`, `trips`, `problems`, `maintenance`, `commands`; Overview includes the last 24 hours of recorded track with coverage/truncation; Commands selects an installed Device                                                                     |
| `/fleet/devices`            | Register/edit globally unique IMEI, ERM serial, module, model/options, SIM and assignment; clear assignment to stock; open `/:id/overview`, `problems`, `commands`, `sms-commands`, `parameters` or `technical-details/events` and `technical-details/frames`; Trips links to the currently assigned Vehicle |
| `/fleet/drivers`            | Contact/identification/documents; 7/30/90-day scorecard; assigned drivers cannot be deactivated/deleted                                                                                                                                                                                                      |
| `/fleet/maintenance`        | Planned-only edits; completion can atomically schedule the next task; DONE/CANCELLED history is read-only                                                                                                                                                                                                    |
| `/fleet/settings/groups`    | Manage groups and counts; groups containing Vehicles cannot be deleted                                                                                                                                                                                                                                       |
| `/fleet/settings/general`   | Branch name, zone, date format, display units, Fleet thresholds and notification retention                                                                                                                                                                                                                   |
| `/fleet/notifications`      | Filter Branch notifications by read state/category, open related records and mark individual/all items read                                                                                                                                                                                                  |

`/:language/profile` and `/:language/settings/users` are account routes without a Branch prefix.
The sidebar lists Dashboard, Vehicles, Devices, Drivers and Maintenance, followed by Settings
and Users without a visible group heading. Settings opens General with General | Vehicle groups
tabs; Users is separate and has no Settings tabs. Legacy Overview/Alerts/Trips, Control center and Vehicle alerts/service
URLs redirect to canonical destinations while retaining applicable record/query/fragment context.

IMEI remains a globally unique 15-digit string; assignment is optional and scoped. Several
Devices may share one Vehicle. Manual odometer readings never create device activity or advance
the data clock. Service completion odometers use earlier service history, separate from telemetry;
EUR costs retain exact cents and zero. An inactive Vehicle allows historical completion without
next planning. Unsupported hardware actions are labelled unavailable; no restart is simulated.
Previous `/reference` URLs redirect to `/fleet` with editor/query/fragment context intact.

General settings uses [the documented defaults and bounds](architecture.md#branch-settings).
Display units convert read values/charts; API values and explicitly labelled canonical filters
remain km, km/h and litres. Date-only documents/service values are not shifted between zones.
Save persists Fleet preferences first, then renames Core's Branch only if changed. A failed
rename leaves saved Fleet values applied, retains the name draft and reports partial success.
Discard restores actual persisted values. The speed reference creates no alerts or device commands.
Dates use the Branch's `YYYY-MM-DD`, `DD.MM.YYYY` or `MM/DD/YYYY` preference and IANA time zone;
instant tooltips expose the exact UTC timestamp. GPS age is independent of Connected (current
socket), Reporting (expected-frame freshness) and Live (both).

### Notifications

The bell displays recent persisted Branch notifications, the unread count, **Mark all as read**
and **See all**. The Notifications page offers read-state/category filters and individual/bulk
read actions. Read state belongs to the signed-in user; demo sessions can view the feed but
cannot save read state. Sources are Fleet alert transitions, recorded device diagnostic/alarm
evidence and terminal durable command outcomes. Recorded evidence does not establish an
unresolved fault. Notifications are in-app only; no email/SMS delivery provider is configured.

General settings saves notification retention, default seven days. Daily cleanup removes old
feed entries and their read receipts by feed creation time, preserving telemetry and command
audit. Feed collection does not depend on an open browser.

## Admin translations

Use Bulgarian/English catalogs for all live text, including controls and errors. Route language
sets document language and captured `Accept-Language`; record content displays as received.

## GraphQL usage

Through Gateway, call `signIn(email: ..., password: ...) { token expiresAt tenant { id name } }`.
Use the token for `{ branches { id name } }` and business requests. The explicit development
demo alternative is `{ tenants { id name } }`, then
`demoLogin(tenantId: "01000000-0000-4000-8000-000000000001") { token tenant { id name } }`.
Discordia's seeded
`x-branch-id` is `10000000-0000-4000-8000-000000000001`.

```graphql
query VehiclesWithBranches {
  fleetVehicles(offset: 0, limit: 20) {
    items {
      id
      licensePlate
      branch {
        id
        name
      }
    }
    total
  }
}
```

The [standard list contract](architecture.md#standard-list-contract) defines search, filters,
sorting and bounds. Use feature SDL and generated operations for other queries/mutations,
then follow [generation/validation](../../AGENTS.md#nestjs) after contract changes.

## ERM relay

`npm run erm:relay` runs a transparent TCP relay for ERM StarLink devices
([source](../../tools/erm-relay/relay.mts)). It is a standalone process outside `npm run dev`,
so application restarts do not drop device connections. Configure it from the root `.env.example`.

- A device connection whose first byte is the StarLink header `$` is forwarded byte for byte to
  `ERM_RELAY_UPSTREAM` (Karma ingestion, `in.karma.online:500`). Karma keeps acknowledging events
  and sending commands; the relay never writes frames itself. Other first bytes, no data within
  60 seconds or an unreachable upstream close the device connection.
- Complete CR LF frames of both directions are appended to `ERM_RELAY_CAPTURE_DIR/<UTC date>.jsonl`
  with connection events, unit ID, command, reference and the checksum state from the
  [StarLink checksum rule](erm-resources/starlink-online-protocol/authenticated/pages/G2.md).
  The capture contains vehicle positions; keep it private.
- Devices reach the relay through a public layer-4 TCP forward to `ERM_RELAY_PORT`, without HTTP
  or TLS termination and with an idle timeout of at least two hours. Test reachability with data
  that does not start with `$`; the relay rejects it without contacting Karma.
- If the relay is unavailable, point the public forward directly at the upstream so routed
  devices keep reporting to Karma without a device write.

## ERM device server

`apps/erm-server` (`@holita/erm-server`) runs independently from compiled output. It remains
outside `npm run dev` and `npm run kill`, so restarting the web/API group leaves its device
connections open. The gateway process (`ERM_ROLE=gateway`) owns device sessions and the internal API on
HTTP 11015/TCP 11500. The api process (`ERM_ROLE=api`, HTTP 11017) owns the GraphQL subgraph
and uses the gateway for live sessions and command delivery. Both share `holita_erm`; see
[ADR 0007](../architecture/decisions/0007-erm-gateway-and-api-processes.md).

`ERM_PRIMARY_UNITS` is a comma-separated unit allowlist, empty by default. The first complete
device frame selects the connection's mode:

- **Mirror:** forward device and Karma traffic byte for byte. Karma owns acknowledgements and
  commands.
- **Primary:** holita immediately confirms complete device frames with a valid checksum whose
  command appears in `ERM_ACK_COMMANDS` (default `06`), using confirmation reference mode 0. Device traffic is still
  mirrored to Karma, except confirmations of holita commands. Duplicate Karma confirmations for
  messages holita acknowledged are dropped. Karma authentication answers and other commands still
  reach the device. Holita and Karma whole-frame writes share one device queue.

Primary sessions stay connected when Karma closes or cannot be reached: holita keeps recording,
confirming `ERM_ACK_COMMANDS` frames and accepting commands, holds the traffic for Karma in order
and reconnects after 1 second, doubling to at most 60 seconds (a link that stayed up for 60 seconds
resets the delay). A mirror session still closes when its established Karma link closes; its first
connect gets at most three attempts (about 30 seconds) while the device's bytes wait. After a failed
connect by name, both modes retry at once with the last Karma IP address that worked in this
process. Changing the allowlist affects new connections.

Copy the ERM Server entries from the [root environment reference](../../.env.example) into the
ignored `apps/erm-server/.env`, preserving existing settings. HTTP `/health` defaults to
`127.0.0.1:11015`; `ERM_DEVICE_HOST`/`ERM_DEVICE_PORT` default to `0.0.0.0:11500`.
`ERM_UPSTREAM` defaults to `in.karma.online:500`. `ERM_CAPTURE_DIR` defaults to
`.references/erm-server` relative to the repository root, including when started from the app
directory. Its daily UTC JSON Lines files preserve the relay's record fields and include
`from: "holita"` for server-originated frames; directory mode is `0700` and file mode is `0600`.
Captures contain vehicle positions and must remain private.

Provision missing databases/roles, deploy this application's migrations and build from the
repository root, with PostgreSQL already running:

```bash
npm run db:setup
npm run db:test:setup
npm run db:migrate --workspace @holita/erm-server
npx nx run erm-server:build
ERM_ROLE=gateway npm run start:prod --workspace @holita/erm-server
```

Provisioning is additive and preserves existing data/passwords. Development uses `holita_erm`;
guarded tests use `holita_erm_test` with isolated per-run schemas. Connection, frame, command,
event and upstream-close database writes are asynchronous; database failures are logged while
forwarding and acknowledgements continue. Fleet separately pulls decoded events when
`FLEET_ERM_TELEMETRY_ENABLED=true`, as defined in ADR 0008; the gateway never pushes into Fleet.
A gateway start closes connection rows left open by a previous process, so never start a second
gateway against the same database while one runs.
A graceful gateway stop records its sessions as `server stopped` and waits for capture writes
before disconnecting from the database.

`ERM_EVENT_STRUCTURE` defines the ordered fields in device `06`/`86` events in both modes. Its
default is the Karma preset for device parameter 0177 in the [environment reference](../../.env.example).
Set it to the actual device value before interpreting telemetry. Times use UTC `YYMMDDHHMMSS`
(the default format for parameter 0176); latitude/longitude are converted from signed degrees and
minutes to decimal degrees, and speed from knots to km/h. `odometer` preserves `#ODOD#` from the
source selected by parameter 0004, which may be engine hours rather than distance. Named fields
retain raw text; missing or unparsable parsed values become null, and trailing fields remain in
`extra`. Decoding failures are logged without affecting device traffic.
A resent report with the same unit, reference, event ID and event time is stored once; all its frames remain.

After correcting `ERM_EVENT_STRUCTURE` or deploying a decoder change, re-decode stored frames
with the same `ERM_DATABASE_URL` and `ERM_EVENT_STRUCTURE` as the gateway. From
`apps/erm-server`, run the deployed copy with its environment file:

```bash
node --env-file=/home/sysadmin/.config/holita/erm-server.env live-api/redecode.js
```

The command opens no listener or HTTP server and may run while the gateway and api are running.
It scans complete DEVICE frames received at least one minute before the run began, in ID order
and batches, and prints frames scanned, events updated, events inserted, surplus stored events
and decode failures. It updates changed events in place, inserts missing events and leaves surplus
events intact; frame rows are never changed. Running it again without decoder changes changes
no events.

The listener accepts at most 64 connections. A device must begin with `$` and complete its first
frame, or reach the 16 KB frame bound, within 60 seconds before Karma is contacted. A first frame
that is not a recognizable unit frame is still mirrored. Each upstream connect attempt has
10 seconds. Closing the device closes its upstream link. A unit's newly identified connection
closes its older sessions (`replaced by a newer connection`), and commands go to the newest one.
Karma closes that do not end a primary session are stored in `ermUpstreamClose` and captured as
`upstream-close` events. The public path must forward raw TCP with no HTTP/TLS termination.
The relay and ERM Server share the default device port; run them together only on different free
ports, for example:

```bash
PORT=11018 ERM_DEVICE_PORT=11501 ERM_ROLE=gateway npm run start:prod --workspace @holita/erm-server
```

### GraphQL and admin inspection

Router's `ERM_SERVER_GRAPHQL_URL` points to the api process at
`http://127.0.0.1:11017/graphql`. Run it separately with `ERM_ROLE=api` and `PORT=11017`;
it must not open the device TCP listener. Configure Core verification for user sessions and the
same demo-session settings as Core/Fleet when explicitly using development demo login.
Keep the gateway's loopback internal API and machine token private.

The admin **Devices** section opens one Device page with Overview, Problems, Commands,
SMS commands, Parameters and Technical details (events/frames). Trips opens the currently
assigned Vehicle's trips. Vehicle Commands selects a particular installed Device and uses the
same readable history and details modal. Legacy Control center and diagnostics URLs redirect
to these pages. Fleet diagnostic counts include added DTC observations, recorded CAN evidence and
the latest red, yellow or information warning lamps for the current vehicle/IMEI pair. Deleted
fault observations do not increase the count. The count does not establish active ECU faults;
the Problems rows expose every recorded fault in `diagnostics`, including deleted observations
whose status does not prove a repair. Fleet owns the ten registered truck identities,
including `serialNumber` and `edataModule`; ERM state is joined by IMEI. Use Branch-scoped
Device fields for operator journeys:

```graphql
query DeviceControlCenter($id: ID!) {
  fleetDevice(id: $id) {
    id
    imei
    serialNumber
    edataModule
    ermState {
      online
      mode
      lastFrameAt
      alarmsLast24h
      mainVoltage {
        value
        observedAt
      }
      backupVoltage {
        value
        observedAt
      }
      signalQuality {
        value
        observedAt
      }
      firmwareVersion {
        value
        observedAt
      }
      health {
        lastFrameAgeSeconds
        expectedIntervalSeconds
        overdue
        lastCloseReason
        lastClosedAt
        upstreamClosesLast24h
        karmaRoutingWritesLast24h
        latestKarmaRoutingWrite {
          receivedAt
          command
          displayText
        }
      }
    }
    ermEvents(input: { pageSize: 25, categories: [ALARM, EDATA] }) {
      items {
        id
        eventId
        category
        severity
        name(language: EN)
        eventTime
        fields
      }
      nextCursor
      hasMore
    }
    ermCommands(input: { pageSize: 25 }) {
      items {
        id
        command
        status
        resultCode
        sentAt
      }
      nextCursor
      hasMore
    }
    ermFrames(input: { pageSize: 25 }) {
      items {
        id
        direction
        receivedAt
        displayText
      }
      nextCursor
      hasMore
    }
  }
}
```

`ermState` is null when the unit has neither an ordinary connection nor a recorded recovery
session. Categories are POSITION, STATUS,
ALARM, EDATA and OTHER; severities are INFO, WARNING and CRITICAL. Names accept BG/EN and
are null for unknown event IDs. History uses 25/50/100-item newest-first cursor pages; pass
`nextCursor` for the same device/filter. Raw fields remain evidence, not inferred meanings.
ERM data is available only through these Fleet Device fields with the caller's verified Tenant
and active Branch. The provider queries `ermUnits`, `ermEvents`, `ermFrames` and `ermCommands`
are no longer exposed.

The Device health line shows receipt-time gaps in the last 24 hours (more than twice the
estimated reporting interval), mobile-network changes and the last close reason. Expected
intervals are estimates: five minutes driving and one hour parked. Network changes use event 23
and changes in decoded network/operator fields; missing fields are not changes. Shared lists
explain parked, overdue and backup states without additional Karma polling. Fleet retains the
current observed backup start, the last completed period and cumulative backup time. An open
period includes silence until holita is observed again; it does not prove continuous traffic.
Backup-history collection requires `FLEET_ERM_HEALTH_ENABLED=true` in Fleet; its default is off
so the development watcher cannot start the new collector before deployment. When off,
`routingHealth` is unavailable and existing routing detection continues.

`sendErmDeviceCommand(input: { deviceId, action, expiresInSeconds, intent })` accepts only
REQUEST_LOCATION, READ_STATUS, READ_VERSION, READ_ACCESSORIES, READ_EDATA_DIAGNOSTICS and
READ_EDATA_FAULTS. It verifies the Device through Fleet with the caller's session and active
Branch and returns a durable request. The Device's **Commands** tab can queue these reads while
offline, choose expiry (default two hours, maximum 24 hours), and cancel a QUEUED request through
`cancelErmDeviceCommand(input: {deviceId, requestId})`. Settings and snapshots still require a
primary connection.

The command queue API also provides Branch-wide history through
`ermCommandRequests(offset: 0, limit: 20, filter: ...)`, returning `items`, `total`, `offset` and
`limit`. The maximum limit is 100; rows sort by `createdAt DESC, id DESC`. Filters are `statuses`,
`actions`, `deviceIds`, `imeis`, `actorId`, `createdFrom` (inclusive) and `createdTo` (exclusive).
List filters accept 1–100 unique values. Every row retains its Device ID and IMEI (`unitId`),
issuer, outcome, lifecycle times, expiry, `retryOfId`, `batchId` and `batchIndex`.
`retryErmDeviceCommand(input: {requestId, expiresInSeconds, intent})` explicitly creates a new
linked request from FAILED, EXPIRED, UNCERTAIN or CANCELLED, rechecking the Device's current Fleet
ownership and IMEI. The original remains unchanged; default retry expiry is two hours.

`startErmCommandBatch(input: {deviceIds, action, expiresInSeconds, intent})` verifies 1–100 unique
Devices in the active Branch and atomically queues one permitted read per Device in the supplied
order. `ermCommandBatch(id)` returns issuer, operation, creation and stop audit, counts for every
request status and the ordered requests. Each batch waits for its preceding request to settle
before advancing; an offline first Device holds later requests. Reads use the existing primary-mode,
Fleet-target and per-unit workflow checks. `stopErmCommandBatch(id)` records `stoppedAt` and
`stoppedByActorId` and cancels only requests still QUEUED; submitted requests retain their outcome.
These APIs are available for the command workspace; the current admin operations remain compatible.

The API worker waits for primary mode and rechecks the stored Tenant/Branch/Device/IMEI through
Fleet before sending once. Configure the same `ERM_TELEMETRY_TOKEN` in Fleet and ERM API; the
Fleet URL comes from `FLEET_GRAPHQL_URL`. QUEUED can become SUBMITTING, ANSWERED, FAILED, EXPIRED,
CANCELLED or UNCERTAIN. An API restart changes interrupted SUBMITTING to UNCERTAIN. Ambiguous
submissions are never replayed automatically. Acceptance is not delivery, a unit rejection is
shown plainly, and a read response is not configuration verification. If the browser loses the
mutation result, inspect the audit before making another decision. A queued request exposes its
current `waitingReason` and the start of that wait (`waitingSince`): `GATEWAY_UNAVAILABLE` for discovery
failure, `FLEET_VERIFICATION_UNAVAILABLE` for target-verification failure, or `UNIT_NOT_CONNECTED`
when primary discovery succeeds without that unit. These reasons do not alter submission rules.
Command notifications retain `REPLY_TIMEOUT` and `TRANSPORT_FAILED` when linked transport evidence
is available, as command history does. The same Branch export includes settings runs ending in
`RESTORE_FAILED`, `MISMATCH` or `UNCERTAIN`, failed snapshots and completed snapshots with unread
parameters. These notifications link to the Device and retain the operation/outcome without
exporting parameter values.

The Commands tab shows readable request purpose, target, lifecycle times, expiry and outcome.
Queued/offline and waiting states stay visible across polls, and details expose parameters,
intent, actor, transport IDs, exact sent/received frames and configuration verification.
A device acknowledgement links to its request and means device confirmation, not proof of
execution. Settings and snapshots show their
actor and intent alongside steps and before/after evidence. New actions from real sessions record
the verified Core `userId` as their actor, including `cancelledByActorId` on cancelled requests
and the issuer/stopping actor on batches. Demo sessions identify the Tenant only
(`demo-tenant:<tenantId>`); historical demo audit rows remain unchanged. Audit history and
snapshot diffs use the stored Tenant/Branch/Device scope, so
unattributed legacy tool runs are not included in this operator history.

The current Device's **SMS commands** tab uses its stored SIM number and SMS password; it
never asks the operator to choose a different target. Cards explain each purpose, message text,
expected reply and timeout meaning. Copy prepares text; **Open SMS app** fills the phone's
message composer and never sends from holita. Missing credentials link to the Device editor,
and unavailable/overlength messages cannot be opened for sending. A timeout leaves the result
unknown. Routing messages retain their explicit warning and require the operator to confirm
the resulting device connection independently.

The Device's **Parameters → Device settings** editor starts background controlled workflows
through `startErmEdataChange` (read, one interval, one definition or globals `302`) and
`startErmParameterChange` (one catalog parameter through `04`) and
`startErmParametersChange(input: {deviceId, parameters: [{parameter, value}], restoreAfter})`
(one `46` containing only that explicit parameter set). Each run exposes the structured
`operation` (`READ_EDATA`, `INTERVAL`, `ADD_DEFINITION`, `GLOBALS`, `PARAMETER` or `PARAMETERS`)
for translated labels while retaining `intent` as audit text. Writes require
`ERM_CONFIGURATION_WRITES_ENABLED=true` in the API process; reads remain available when off.
Every write workflow captures a fresh parameter snapshot, then reads its exact target baseline,
writes, independently reads back and restores the exact baseline on a mismatch or when requested.
Globals compare every written byte, including bytes 11–13. Only one snapshot, setting workflow
or operator read can run per unit in the API process. Routing and protected parameters remain
refused. Unit rejections, including unsupported event-description writes, appear in the run's
steps and failure reason. A persisted `UNCERTAIN` write is never replayed; inspect the evidence
and reconcile it before making a new decision: an uncertain eData write requires a fresh eData
read; an uncertain `04` or `46` blocks writes of the same parameters until fresh `03`/`45` replies
read those parameters successfully. An eData read cannot clear parameter uncertainty. The run list
shows the latest 20 runs.

`startErmParameterBatch(input: {deviceIds, parameters: [{parameter, value}], restoreAfter})`
starts the same verified `46` workflow for 1–100 unique Branch Devices in the supplied order.
Only one unit runs at a time; any result other than `VERIFIED` stops the batch and refuses its
remaining runs. Each unit rechecks current Fleet ownership, primary mode and the write switch.
`ermConfigurationBatch(id)` reads the scoped progress, ordered changes and stop/completion audit.
`stopErmConfigurationBatch(id)` lets the current unit finish safely and refuses remaining runs.
An interrupted batch is retained and never replayed automatically.

Engineers and Administrators signed in to a Fleet Device's active Branch can call
`startErmParameterSnapshot(input: { deviceId })` while the unit is connected in primary mode,
then read `ermParameterSnapshots` on that Device. The api reads catalog parameters 0001–9999
except routing 0049–0054 in about 70 sequential commands, with individual retries for rejected
batches; completion time depends on the unit's replies. Tracker replies also reach Karma inside
`$SLC`. Snapshots record each parameter as `READ`, `REJECTED` or `OMITTED`. `COMPLETE` means the sweep
finished, and `readCount` counts processed outcomes; it does not promise every value was read.
Changes compare only parameters read in both snapshots; `unreadParameters` lists parameters
excluded because either snapshot did not read them. Values remain stored in ERM; protected
values such as 0593 are masked for Viewers and visible to Operators and above. An api restart marks snapshots left
RUNNING as FAILED with `interrupted by an api restart`.

For controlled single-record eData configuration changes, run the operator command from
`apps/erm-server` with `ERM_DATABASE_URL`, `ERM_GATEWAY_URL` and `ERM_INTERNAL_TOKEN` in the
environment file below. Set `IMEI` to the selected primary-mode unit and `DEFINITION` to one
approved 44-hex, 22-byte definition; `--split <Monitor-export-file-or-301-payload>` works offline
and prints each parameter ID, interval and definition without executing the export. A read prints
the complete definitions, raw `410` globals and `416` profile ID. Changes require a complete
exact-unit baseline and an equal preflight no older than 120 seconds; missing interval targets,
existing addition IDs and unchanged intervals are refused. Each step is stored in
`ermConfigurationChange`; verification compares the whole set (an added definition's predefined
multiplier/divisor 1/1 may read back as 0/0), and a mismatch or
`--restore-after` restores the captured definition, or deletes only the ID added by that run,
then verifies the whole baseline. No replace or multi-definition write is allowed. An UNCERTAIN
submission is never retried and requires a successful fresh `--read` before another change.

```bash
node --env-file=/home/sysadmin/.config/holita/erm-server.env live-api/edata-change.js --unit "$IMEI" --read
node --env-file=/home/sysadmin/.config/holita/erm-server.env live-api/edata-change.js --unit "$IMEI" --parameter 1 --interval 60
node --env-file=/home/sysadmin/.config/holita/erm-server.env live-api/edata-change.js --unit "$IMEI" --add "$DEFINITION"
node --env-file=/home/sysadmin/.config/holita/erm-server.env live-api/edata-change.js --unit "$IMEI" --add "$DEFINITION" --restore-after
```

The same operator tool accepts `--unit "$IMEI" --globals "$GLOBALS" [--restore-after]` for one approved 98-hex globals payload, comparing the exact written bytes on readback and restoring the exact baseline after a mismatch; `302` is available only from its recorded workflow submission, outside the generic command allowlist.
For a reversible single-parameter change, run `node --env-file=/home/sysadmin/.config/holita/erm-server.env live-api/parameter-change.js --unit "$IMEI" --parameter 0774 --value "$VALUE" --restore-after` after taking the unit's snapshot: routing 0049–0054 and protected catalog parameters are refused, and an unconfirmed write is recorded UNCERTAIN, read back once and never retried or restored automatically.

### Internal unit and command API

The HTTP listener is loopback-only. `/internal/units` endpoints are disabled unless `ERM_INTERNAL_TOKEN`
is set to a private random value of at least 32 characters. Requests require
`authorization: Bearer <token>`; keep the token in the service environment. For one unit, the
relevant application `.env` entries are:

```dotenv
ERM_PRIMARY_UNITS=862129080366630
ERM_ACK_COMMANDS=06
ERM_INTERNAL_TOKEN=<random-token-of-at-least-32-characters>
```

With the same token exported in the calling shell:

```bash
curl --fail --silent --show-error \
  -H "authorization: Bearer ${ERM_INTERNAL_TOKEN}" \
  http://127.0.0.1:11015/internal/units

curl --fail --silent --show-error \
  -H "authorization: Bearer ${ERM_INTERNAL_TOKEN}" \
  -H 'content-type: application/json' \
  --data '{"command":"03","fields":["0774"]}' \
  http://127.0.0.1:11015/internal/units/862129080366630/commands
```

`GET /internal/units` returns an array of `{ unitId, mode, peer, connectedSince, lastFrameAt }`;
timestamps are ISO strings. `POST /internal/units/:unitId/commands` requires a connected primary-mode
unit and accepts only these command/field combinations:

| Command                                        | Fields                                                                                                                                                                                                                                                                             |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `03`                                           | One parameter number outside 0049–0054, for example `["0774"]`.                                                                                                                                                                                                                    |
| `45`                                           | One or more parameter numbers, all outside 0049–0054.                                                                                                                                                                                                                              |
| `48`                                           | One template of dynamic parameters, for example `["VER=#VER#"]`.                                                                                                                                                                                                                   |
| `05`                                           | Empty array or one maximum-wait value in seconds (1–4 digits).                                                                                                                                                                                                                     |
| `07`, `12`, `16`, `19`, `49`, `56`, `60`, `61` | Empty array (`56` only lists accessories).                                                                                                                                                                                                                                         |
| `08`, `10`, `23`, `27`, `36`, `43`, `51`, `53` | One input, zone, rule, parameter, pattern, sensor or device number.                                                                                                                                                                                                                |
| `30`                                           | Fixed eData reads (including globals `19,0,19,303,0,1,1,`), or `19,0,19,301,0,1,1,02` plus one 44-hex definition, or `19,0,19,301,0,1,1,10` plus one four-hex ID, always as eight fields. The `10` form is only for restoring an addition recorded by the operator workflow above. |
| `04`                                           | One parameter/value pair.                                                                                                                                                                                                                                                          |
| `46`                                           | Alternating parameter/value pairs.                                                                                                                                                                                                                                                 |

A `04`/`46` write either sets only primary server parameters 0049/0050 or avoids all routing
parameters 0049–0054. Writes to 0051–0054 are rejected: the backup stays Karma, and primary and
backup are never changed together. Other writes never change lock codes (0059/0060), the SIM PIN
(0061), the shared secret (0187), the operator and SIM locks (0524/0525) or the Simple SMS password
(0593). Reads of protected parameters, including 0593, remain allowed. Values contain no quotes or commas.

The call waits up to 30 seconds. `04`/`46`/`05` complete on the device's `02` confirmation for
holita's reference; the other commands complete on the device's reply with the same command, or
on a `02` error. For `03`/`45`, a `02` result `01` is only a receipt; any other result ends the read.
A `45` reply may contain a non-empty subset of the requested parameters, with complete
parameter/value pairs and no unrequested parameters; only the returned pairs appear in `fields`.
holita confirms that reply and does not forward it to Karma, because Karma reads
routing values from such replies and writes its own server back. Replies inside `$SLC` containers
still go to Karma unchanged, so `03`/`45` reads of 0049–0054 are rejected entirely.
Units sending binary `$SLB`/`$SLC`
frames are identified from the IMEI in the frame header. HTTP 200 returns
`{ id, reference, status, resultCode, fields }`, with status
`answered`, `timeout` or `failed`. Only one holita command may be pending per connection.
Invalid commands return 400, disconnected units 404, and mirror/busy units 409. Reconnecting to
Karma does not block holita commands.
The API returns 401 for invalid credentials and 503 when its token is unconfigured. Command
requests, outcomes and exact responses are persisted. No command is retried automatically.

The api and all roles serve `GET /internal/telemetry/units/:imei/events?after=<id>&limit=<1-500>` on
loopback with the separate bearer `ERM_TELEMETRY_TOKEN` (at least 32 characters). It returns
`{ events, next }`: decoded readings ordered by event id, with decimal-string ids and ISO
timestamps, excluding frames received less than 10 seconds ago. `after` defaults to `0`, `limit`
to 500, and an empty page keeps `next` equal to `after`. Raw frames, fields and commands are
excluded. Each event also has `ignitionOn` (binary Tracker flags or an `#IGN#` token, else null) and
`edata`: null, or one of these normalized reports:

- `405`: `{ report, measurements: [{ parameterId, parameterType, valueSize, valueHex }] }`.
- `411`: `{ report, can, j1708, obd, obdMask, canError, ignition }`.
- `413` / `418`: `{ report, faults: [{ code, status: ADDED | DELETED }] }`.
- `417`: `{ report, noCanMessages: true }`, recorded as CAN communication loss.
- `419`: `{ report, faults: [{ spn, fmi, status: ADDED | DELETED }] }`.

Reports retain event and receipt times. `ErmEvent.edata` shows every
decoded eData report of an External device (33) event with its raw payload. See [ADR 0008](../architecture/decisions/0008-erm-telemetry-into-fleet-activity.md) for
Fleet's telemetry job.

`FleetDevice.warningLamps` and `FleetVehicle.warningLamps` expose the latest stored `405`
measurements for eData 1896 (brake system malfunction), 1906 (engine/MIL) and 1910 (ABS failure),
with the Device, raw value and measurement time. Collection requires
`FLEET_ERM_EDATA_MEASUREMENTS_ENABLED=true`; existing import cursors are not rewound.
The one-byte FMS1 scalar states are `0` OFF, `1` RED, `2` YELLOW, `3` INFORMATION,
`4`–`6` RESERVED and `7` NOT_AVAILABLE. A missing report or unsupported encoding is UNKNOWN,
never OFF. A timestamp establishes the last observation, not continuing coverage or fault clearance.

### Development and service management

For development only, `npm run dev:erm-server` runs its watcher with the same configuration.
The running `holita-erm-server` user service uses `apps/erm-server/live/`; do not restart it
or replace its files without the owner. Deploying the new gateway is a separate owner step.
For a **new, separate installation**, save a user unit such as
`~/.config/systemd/user/holita-erm-server.service`, replacing paths with this installation's
absolute repository and Node executable paths (`command -v node`):

```ini
[Unit]
Description=holita ERM StarLink device server
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
WorkingDirectory=/path/to/holita/apps/erm-server
Environment=NODE_ENV=production
Environment=ERM_ROLE=gateway
EnvironmentFile=/path/to/holita/apps/erm-server/.env
ExecStart=/absolute/path/to/node /path/to/holita/apps/erm-server/dist/main.js
Restart=on-failure
RestartSec=5
UMask=0077

[Install]
WantedBy=default.target
```

Set the chosen free `PORT` and `ERM_DEVICE_PORT` in that application's `.env` before enabling the
new unit with `systemctl --user daemon-reload` and
`systemctl --user enable --now holita-erm-server.service`. Restarting ERM Server closes its TCP
sessions. Devices return at their next scheduled transmission, even when always connected: on the
fleet's settings about 5 minutes with ignition on and up to an hour when parked, or at once after
a call to the unit's SIM. The example unit runs `dist`; the existing live service runs `live`. Rebuilding the
checkout does not deploy to `live`. API-only deployments must leave the gateway running.

### Moving a unit between Karma and holita

Karma API v2 rejects StarLink parameter writes (`04`, `46`, `PUT /parameters`) but accepts command
`98` ([connect to configuration server](erm-resources/starlink-online-protocol/authenticated/pages/C98.md)),
which opens a temporary session from the unit to a given host and port without changing its
configuration. `npm run erm:route-unit` ([source](../../tools/erm-relay/route-unit.mts)) serves that
session: it reads 0049–0052 with `45`, writes 0049/0050 with `46` only when they hold the other
server, reads them back and writes the previous values again if they differ or the backup
0051/0052 changed. It confirms the `45` replies, sends no other command, ends the session 2 s after
the result and appends every frame to `ERM_RELAY_CAPTURE_DIR/route-unit-<UTC date>.jsonl`.

Karma writes its own 0049/0050 back with `46` within about ten minutes once its parameter cache
shows another server; it did so when a unit resent an unconfirmed read-back reply to its new primary
server. Never read 0049–0052 through Karma for a unit routed to holita.

Configuration sessions (Karma command `98` to the unit) use a port in 11501–11509, forwarded like
the device port 11500, so the tool runs beside the gateway with `--port <port>`; `--holita` stays
the ordinary device endpoint written to 0049/0050:

```bash
npm run erm:route-unit -- --unit 862129080366630 --to holita --holita <public-host>:11500 --port 11501
```

While the tool waits (`--wait-minutes`, default 140), queue `98,1,<public-host>,11501` for
the car through Karma `POST /commands`; a parked unit receives it at its next transmission. Exit
code 0 means moved and verified, 2 not moved, 3 uncertain and 4 no session. After an uncertain
result, read the log; the unit's next ordinary connection, to ERM Server or in Karma `/events`, shows
where its primary server points. To move a unit back, run the tool with `--to karma`, no command
`98` and the default port 11500 in an owner-approved gateway stop
(`systemctl --user stop holita-erm-server` before, `systemctl --user start holita-erm-server` right
after): the unit's next ordinary connection reaches the tool. Other units that use holita reach it
too and are not forwarded to Karma, so run it between their sessions (open sessions are
`ermConnection` rows without `closedAt`). A unit whose backup server (0051/0052) is Karma fails
over to it by itself while holita is unreachable.

A unit can stay on that backup after holita drops it, as CB6711TE did after a gateway restart.
The API role's temporary Karma module checks `ERM_PRIMARY_UNITS` every five minutes using a
30-minute event window. It marks a unit `KARMA_BACKUP` when its latest Karma report is more than
three minutes newer than holita's last device frame. For a newly detected episode whose last
holita frame is older than the current window, one additional lookup reads the first 30 minutes
after that frame. `since` records the first later Karma report from that lookup and stays null if
no such report is found. Later polls preserve the episode start. `FleetDevice.ermRouting` exposes
routing, its observation time, the latest Karma report, whether the latest event establishes that
the unit is parked, and the latest return attempt with its recovery result. The former Karma Client treats
`date_type=utc` / `edt` as UTC and `edt_tz` as local time; an event outside the requested UTC window
is rejected rather than reinterpreted as Europe/Sofia time.

Set `KARMA_USER`, `KARMA_PASSWORD` and `ERM_RECOVERY_ENDPOINT` in the API process's private
environment to enable detection and returns; `KARMA_API_URL` defaults to
`https://karma.online/apiv2/`. Without complete valid configuration routing is `UNKNOWN` and a
return is unavailable. The recovery endpoint is the public `host:port` the unit can reach, normally
the permanent listener on 11510 described below. An Engineer or Administrator can request the
explicit `returnErmDeviceToHolita` mutation for a Device in the active Branch. It refreshes Karma status, requires
`KARMA_BACKUP`, a parked latest event (`eid` 5, or `eid` 1 with first `extra` field `0`) and no
pending return, then queues only `98,1,<recovery-host>,<port>`. This temporary session changes no
device settings. The attempt records its actor, submission time and Karma queue ID, and links the
read-only recovery outcome and the next ordinary holita connection. An uncertain submission is
not automatically retried.

Run `98` sessions, for routing or this recovery, only while the truck is parked: reports a unit
sends during a configuration session are lost (CB6711TE's ten driving reports during its
2026-11-03 13:08 session never reached Karma and were not resent).

Port **11510 is reserved for permanent read-only recovery**. Deploy the compiled ERM entry
`apps/erm-server/dist/main.js` with `ERM_ROLE=recovery` in a separate user unit, using the ERM
database configuration. Forward TCP 11510 to it. This role reads only 0049/0050, confirms the read
reply and closes; it never writes routing or forwards a session to Karma. It records either
`ALREADY_HOLITA` (65.108.137.165:11500) or `NEEDS_OPERATOR`, including a timeout, disconnect or
unexpected destination. Deploying it does not require a gateway restart. Apply the additive ERM
migration before deploying the recovery listener or the API that displays its results.

### Vehicle eData history

After applying Fleet's additive measurement migration, enable
`FLEET_ERM_EDATA_MEASUREMENTS_ENABLED=true` alongside `FLEET_ERM_TELEMETRY_ENABLED` to store new
`405` observations. The existing import cursor continues; earlier reports are not backfilled.
The vehicle profile shows the last 24 hours of selected IDs as raw observation dots, exact latest
hex and catalog labels. Catalog units do not establish byte order or physical calibration; verify
those against a known unit before treating the chart as RPM, fuel or temperature. Missing reports
stay gaps. The import contract is in [ADR 0008](../architecture/decisions/0008-erm-telemetry-into-fleet-activity.md).
