# Discocan development

Use the [shared development guide](../development.md) for installation, database setup,
environment, host commands, Storybook and Angular agent tools. The
[domain index](README.md#terminology) defines Branch scope.

## Telemetry admin

Prepare databases, migrate/seed and run `npm run dev`; open http://127.0.0.1:11000.
Choose RentalSofia, then Discordia or Sandbox, and sign in to Overview. `/bg` is the default;
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

### Demo tenant login

Tenant selection obtains a candidate token and loads that Tenant's Branches. The session
starts only after a valid Branch is selected and Sign in is submitted. Core issues an
HMAC-SHA256 session with an eight-hour expiry; all subgraphs independently verify it.
Authenticated requests carry `Authorization: Bearer <session>`; Fleet also needs `x-branch-id`.
A caller-supplied tenant header never selects identity.

Core, Fleet, Karma Client and ERM API use the same `DEMO_AUTH_SECRET` (at least 32 characters).
`DEMO_AUTH_ENABLED=false` disables discovery/login/sessions. Production requires explicit demo
enablement and a valid secret. This login deliberately permits anyone to choose any Tenant;
production needs real identity, membership, permissions and revocation.

Tab sessionStorage retains the unexpired session and selected Branch. Denied storage uses
memory only. Logout honors dirty guards, retires clients and clears the tab session; expiry
also retires it. Submitted writes keep their captured token; no server-side revocation exists.

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

| Destination               | Operator workflow                                                                                                                           |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `/fleet/overview`         | Branch KPIs, attention links, activity by group, recent trips and daily distance                                                            |
| `/fleet/vehicles`         | Create/edit master data, delete/deactivate; profile tabs `overview`, `trips`, `alerts`, `service`; Record odometer opens the profile drawer |
| `/fleet/devices`          | Register/edit IMEI, ERM serial, module, model/options, SIM and assignment; clear assignment to stock; diagnostics and control-center access |
| `/fleet/drivers`          | Contact/identification/documents; 7/30/90-day scorecard; assigned drivers cannot be deactivated/deleted                                     |
| `/fleet/trips`            | Scoped trip detail and complete maneuver timeline; filtered distance and whole-Branch summary remain separate                               |
| `/fleet/alerts`           | Acknowledge OPEN alerts; resolve/reopen with loaded `expectedStatus`; rejected remarks remain editable                                      |
| `/fleet/maintenance`      | Planned-only edits; completion can atomically schedule the next task; DONE/CANCELLED history is read-only                                   |
| `/fleet/settings/groups`  | Manage groups and counts; groups containing Vehicles cannot be deleted                                                                      |
| `/fleet/settings/general` | Branch name, zone, display units and Fleet thresholds                                                                                       |

IMEI remains a 15-digit string unique per Branch; assignment is optional and scoped. Several
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
Discard restores actual persisted values. Notification switches remain disabled Demo controls;
the speed reference creates no alerts or device commands.

## Admin translations

Use Bulgarian/English catalogs for all live text, including controls and errors. Route language
sets document language and captured `Accept-Language`; record content displays as received.

## GraphQL usage

Through Gateway, request `{ tenants { id name } }`, then
`demoLogin(tenantId: "01000000-0000-4000-8000-000000000001") { token tenant { id name } }`.
Use the token for `{ branches { id name } }` and all business requests. Discordia's seeded
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

## Karma Client

Deprecated, view-only: [historical account setup and truck workflows](../archive/karma/development.md#karma-client).

## Background device configuration reads

Deprecated Karma integration: [historical configuration setup and workflow](../archive/karma/development.md#background-device-configuration-reads).

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
forwarding and acknowledgements continue. These records do not populate Fleet telemetry.
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
it must not open the device TCP listener. Use the same demo-session settings as Core/Fleet.
Keep the gateway's loopback internal API and machine token private.

The admin **Fleet** group keeps Vehicles and Devices together. Both lists and the **Control
center** dashboard open one Device page with live state, faults and diagnostics, events, commands,
parameters, frames and SMS. The former Fleet diagnostics URL redirects to its faults tab. Fleet
diagnostic counts are historical DTC/CAN evidence for the current vehicle/IMEI pair, not active-fault
counts; the faults tab also shows alarm and eData events, including cleared faults. Fleet owns the ten registered truck identities,
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

`sendErmDeviceCommand(input: { deviceId, action })` accepts only REQUEST_LOCATION,
READ_STATUS, READ_VERSION, READ_ACCESSORIES, READ_EDATA_DIAGNOSTICS and READ_EDATA_FAULTS.
It verifies the Device through Fleet with the caller's session and active Branch, then uses
the gateway's internal API. This mutation has no free-text command or parameter write.
The recorded command outcome is not proof of a configuration change. Durable offline delivery
and operator audit remain in the [ERM roadmap](../todo/erm-roadmap.md).

The Device's **Parameters → Device settings** editor starts background controlled workflows
through `startErmEdataChange` (read, one interval, one definition or globals `302`) and
`startErmParameterChange` (one catalog parameter through `04`). Writes require
`ERM_CONFIGURATION_WRITES_ENABLED=true` in the API process; reads remain available when off.
Every write workflow captures a fresh parameter snapshot, then reads its exact target baseline,
writes, independently reads back and restores the exact baseline on a mismatch or when requested.
Globals compare every written byte, including bytes 11–13. Only one snapshot, setting workflow
or operator read can run per unit in the API process. Routing and protected parameters remain
refused. Unit rejections, including unsupported event-description writes, appear in the run's
steps and failure reason. A persisted `UNCERTAIN` write is never replayed; inspect the evidence
and run a fresh eData read before making a new decision. The run list shows the latest 20 runs.

Operators signed in to a Fleet Device's active Branch can call
`startErmParameterSnapshot(input: { deviceId })` while the unit is connected in primary mode,
then read `ermParameterSnapshots` on that Device. The api reads catalog parameters 0001–9999
except routing 0049–0054 in about 70 sequential commands, with individual retries for rejected
batches; completion time depends on the unit's replies. Tracker replies also reach Karma inside
`$SLC`. Snapshots include titles and changes against the previous COMPLETE snapshot; values are
stored and shown unmasked, including secrets such as 0593. An api restart marks snapshots left
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

The same operator tool accepts `--unit "$IMEI" --globals "$GLOBALS" [--restore-after]` for one approved 98-hex globals payload, normalizing only bytes 11–13 on readback and restoring the baseline after a mismatch; `302` is available only from its recorded workflow submission, outside the generic command allowlist.
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
`edata`: null, or a decoded eData 411 report
(`{ report, can, j1708, obd, obdMask, canError, ignition }`) or 419 report
(`{ report, faults: [{ spn, fmi, status: ADDED | DELETED }] }`). `ErmEvent.edata` shows every
decoded eData report of an External device (33) event with its raw payload. See [ADR 0008](../architecture/decisions/0008-erm-telemetry-into-fleet-activity.md) for
Fleet's telemetry job.

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
To bring it back, run the tool with `--to holita` on a configuration port and queue
`98,1,<public-host>,<port>` through Karma: the tool reads 0049–0052, finds the primary server
already pointing to holita, writes nothing and confirms the reply, and the unit makes its next
ordinary connection to its primary server (about 5 minutes later on 2026-11-03).

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

`FLEET_ERM_RECOVERY_ENABLED=true` enables automatic requests in Fleet's existing Karma monitoring
job, with monitoring and ERM imports enabled. It sends only `98,1,65.108.137.165,11510`, after
recording the attempt, at most once per unit per two hours. Eligibility deliberately requires the
latest Karma record to be a stationary ignition-off event (05), at least ten minutes old and no
more than seventy minutes old. Ordinary reports and unknown ignition do not qualify. This uses
the existing status poll. Acceptance means Karma queued the request, not that the unit returned;
the Device page shows the attempt and the recovery session outcome separately. An uncertain
submission is retained and never automatically replayed. Check the next ordinary primary
connection; unexpected settings or missing replies need an operator.
