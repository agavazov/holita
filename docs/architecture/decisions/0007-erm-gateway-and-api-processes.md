# ERM gateway and API processes

## Context

[ADR 0006](0006-erm-device-server.md) isolated StarLink sessions from the web applications,
but device sessions, decoding and GraphQL still shared one ERM process. Deploying it disconnects
trucks until their next scheduled transmission: up to five minutes driving and an hour parked.
The provider-level ERM data had no Branch scope, and operators had no authenticated command path.

## Decision

Keep one codebase, `apps/erm-server`, and independently deployed processes selected by
`ERM_ROLE`, sharing the `holita_erm` database:

- **`gateway`** keeps long-lived device sessions, the Karma relay, confirmations,
  frame/event/command records and the token-protected loopback internal API. Its normal
  HTTP/TCP ports remain 11015/11500. Deploy it rarely, with the owner.
- **`api`** serves the schema-first GraphQL subgraph on loopback 11017 from the database,
  asks the gateway for live sessions and delivers commands through its internal API.
  API deployments leave the gateway and truck sessions running.
- **`recovery`** serves only the read-only configuration listener on TCP 11510. It reads
  primary routing 0049/0050, confirms the reply and closes without a parameter write. Its own
  `ermRecoverySession` records never alter gateway connection lifecycles. Deploy it separately;
  the Branch-scoped Device state exposes its latest outcome.

Fleet owns the Device registry and its Tenant/Branch authorization. ERM data reaches a Branch
only through `FleetDevice` fields `ermState`, `ermEvents`, `ermCommands` and `ermFrames`, resolved
by the Fleet-owned external `imei` with `@requires`. Raw ERM ingestion stays provider-level;
it gains no duplicate Device registry or Tenant/Branch columns. Operator operation records keep
the verified scope and target snapshot as audit evidence, independently of raw ingestion. Provider inspection queries are
not exposed; Tenant access uses only the Branch-scoped Fleet Device fields.

`sendErmDeviceCommand` resolves the Device through Fleet using the caller's signed session and
active Branch and stores a durable `ErmCommandRequest`. It accepts only REQUEST_LOCATION,
READ_STATUS, READ_VERSION, READ_ACCESSORIES, READ_EDATA_DIAGNOSTICS and READ_EDATA_FAULTS.
Requests wait for a primary connection, expire (default two hours, maximum one day) and can be
cancelled while QUEUED. The internal machine token stays server-side; the public API has no
free-text command or arbitrary parameter write.

The API worker checks pending requests every ten seconds, shares the existing per-unit workflow
lock and revalidates the captured Tenant/Branch/Device/IMEI through Fleet's read-only loopback
`POST /internal/erm-device-target`. That endpoint uses `ERM_TELEMETRY_TOKEN` and returns only
`{matches}`; no caller session token is retained for delayed execution. Before the one gateway
submission, the worker conditionally stores SUBMITTING. An interrupted submission, timeout or
ambiguous transport outcome becomes UNCERTAIN and is never replayed. Queue acceptance and a
unit answer remain distinct outcomes.

Command requests, configuration runs and parameter snapshots retain verified Tenant/Branch,
Device, IMEI, actor, intent, timestamps and outcome. The current signed demo session identifies
only a Tenant: actor IDs are `demo-tenant:<tenantId>`, not named people. New audit history is
filtered by stored scope and Device ID, including previous snapshot diffs; legacy unattributed
records are excluded. The Device page shows the latest 50 command requests and scoped settings
and snapshot evidence.

The API also exposes controlled `startErmEdataChange` and `startErmParameterChange` workflows.
Writes default off behind `ERM_CONFIGURATION_WRITES_ENABLED`. They verify the scoped Device
through Fleet, require primary mode, capture a fresh parameter snapshot and use the existing
baseline/write/readback/restoration routines. One API unit lock is shared with snapshots and
operator reads. Configuration history records steps and uncertainty; an ambiguous write is
never replayed. Globals verification and restoration compare the exact written/baseline bytes.

This refines ADR 0006's single-process, provider-only read API. It uses the existing database
and internal HTTP boundary without adding another infrastructure service.

## Consequences

Ordinary API changes no longer require disconnecting trucks. Gateway deployments still need an
owner-planned interruption and reconnect/recovery procedure. Both processes need compatible
database contracts, independent supervision and access to the private internal API.

Fleet authorization is mandatory before Branch-visible history or operator commands; a Branch
header alone grants no access. Device read requests still send real commands and retain their
recorded outcomes. Queue acceptance or a reply is not configuration/measurement verification.

Named-person authentication, standalone operation without Karma and production deployment
remain in the [ERM roadmap](../../todo/erm-roadmap.md).
