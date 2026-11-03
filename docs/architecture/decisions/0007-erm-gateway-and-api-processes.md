# ERM gateway and API processes

## Context

[ADR 0006](0006-erm-device-server.md) isolated StarLink sessions from the web applications,
but device sessions, decoding and GraphQL still shared one ERM process. Deploying it disconnects
trucks until their next scheduled transmission: up to five minutes driving and an hour parked.
The provider-level ERM data had no Branch scope, and operators had no authenticated command path.

## Decision

Keep one codebase, `apps/erm-server`, and two independently deployed processes selected by
`ERM_ROLE`, sharing the `holita_erm` database:

- **`gateway`** keeps long-lived device sessions, the Karma relay, confirmations,
  frame/event/command records and the token-protected loopback internal API. Its normal
  HTTP/TCP ports remain 11015/11500. Deploy it rarely, with the owner.
- **`api`** serves the schema-first GraphQL subgraph on loopback 11017 from the database,
  asks the gateway for live sessions and delivers commands through its internal API.
  API deployments leave the gateway and truck sessions running.

Fleet owns the Device registry and its Tenant/Branch authorization. ERM data reaches a Branch
only through `FleetDevice` fields `ermState`, `ermEvents`, `ermCommands` and `ermFrames`, resolved
by the Fleet-owned external `imei` with `@requires`. Raw ERM ingestion stays provider-level;
it gains no duplicate Device registry or Tenant/Branch columns. Provider inspection queries are
not exposed; Tenant access uses only the Branch-scoped Fleet Device fields.

`sendErmDeviceCommand` resolves the Device through Fleet using the caller's signed session and
active Branch before contacting the gateway. It accepts only REQUEST_LOCATION, READ_STATUS,
READ_VERSION, READ_ACCESSORIES, READ_EDATA_DIAGNOSTICS and READ_EDATA_FAULTS. The internal machine
token stays server-side; the public API has no free-text command or arbitrary parameter write.

This refines ADR 0006's single-process, provider-only read API. It uses the existing database
and internal HTTP boundary without adding another infrastructure service.

## Consequences

Ordinary API changes no longer require disconnecting trucks. Gateway deployments still need an
owner-planned interruption and reconnect/recovery procedure. Both processes need compatible
database contracts, independent supervision and access to the private internal API.

Fleet authorization is mandatory before Branch-visible history or operator commands; a Branch
header alone grants no access. Device read requests still send real commands and retain their
recorded outcomes. Queue acceptance or a reply is not configuration/measurement verification.

Durable offline delivery, named-operator audit, parameter snapshots/writes,
shutdown close records, standalone operation without Karma and production deployment
remain in the [ERM roadmap](../../todo/erm-roadmap.md).
