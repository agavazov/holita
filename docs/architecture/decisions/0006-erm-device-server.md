# Independent ERM StarLink device server

The process lifecycle, Branch access and operator command path are refined by
[ADR 0007](0007-erm-gateway-and-api-processes.md).

## Context

ERM StarLink devices push raw TCP frames to a public port. Router, Core and Fleet
serve HTTP/GraphQL and follow the web/API process lifecycle. Adding a device listener there would
drop long-lived truck connections during ordinary application restarts. Raw units also arrive
before any Fleet Vehicle or Tenant/Branch association exists.

The standalone relay preserves Karma's live acknowledgements and commands and captures the wire
traffic, but it has no application-owned persistence for connection and frame inspection.

## Decision

Add one independent NestJS host application, `apps/erm-server` (`@holita/erm-server`), with its own
`holita_erm` database, login role, Prisma client and migrations. Run compiled output as a separate
service outside `npm run dev` and `npm run kill`. HTTP exposes health and an internal API on
loopback protected by a bearer token; the device listener uses a separate TCP port.
The same HTTP listener exposes a schema-first read-only subgraph through Router. It verifies
the shared signed session and exposes provider-level data without Branch filtering. The admin
shows units and their events, raw frames and command history; it has no command-sending UI.

Units stay in byte-for-byte mirror mode unless selected by `ERM_PRIMARY_UNITS`. In primary mode,
holita acknowledges configured device messages and sends allowlisted commands through the internal
API. Karma remains connected for mirrored ingestion, authentication answers and its own commands;
duplicate acknowledgements and device confirmations of holita's commands are filtered. Whole-frame device writes
share one queue.

The application asynchronously records connections, exact frames (including holita's), command
outcomes and decoded device events. Database or decoding errors do not interrupt forwarding or
acknowledgements. Private daily JSON Lines captures retain the relay's record format, adding
`holita` as a frame origin. These provider-level records have no Tenant/Branch columns. Fleet
business records retain their existing scope.

This is the smallest application boundary that gives device sessions an independent lifecycle and
raw data its own persistence without adding TCP responsibilities to the HTTP services. The relay
tool remains available.

## Planned follow-ups

Run devices without a Karma connection.
