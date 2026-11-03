# Independent ERM StarLink device server

## Context

ERM StarLink devices push raw TCP frames to a public port. Router, Core, Fleet and Karma Client
serve HTTP/GraphQL and follow the web/API process lifecycle. Adding a device listener there would
drop long-lived truck connections during ordinary application restarts. Raw units also arrive
before any Fleet Vehicle or Tenant/Branch association exists.

The standalone relay preserves Karma's live acknowledgements and commands and captures the wire
traffic, but it has no application-owned persistence for connection and frame inspection.

## Decision

Add one independent NestJS host application, `apps/erm-server` (`@holita/erm-server`), with its own
`holita_erm` database, login role, Prisma client and migrations. Run compiled output as a separate
service outside `npm run dev` and `npm run kill`. Its HTTP endpoint exposes health only; the device
listener uses a separate TCP port.

Mirror mode forwards device and Karma bytes unchanged with backpressure. Karma remains responsible
for acknowledgements and commands. The application records connection metadata and exact raw frames
asynchronously; database errors are logged without interrupting forwarding. Private daily JSON Lines
captures retain the relay's record format as the raw audit log. Provider-level connection and frame
records have no Tenant/Branch columns. Fleet business records retain their existing scope.

This is the smallest application boundary that gives device sessions an independent lifecycle and
raw data its own persistence without adding TCP responsibilities to the HTTP services. The relay
tool remains available.

## Planned follow-ups

Let holita acknowledge device messages and send commands while Karma is mirrored, then expose
GraphQL and admin views for the captured device data. These capabilities are not implemented by
mirror mode.
