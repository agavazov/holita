# ERM device server: test-device routing and replacing Karma

The receiver exists: [`apps/erm-server`](../../apps/erm-server) mirrors device traffic to Karma,
stores connections, frames, decoded events and holita commands, can confirm and command a device in
primary mode, and exposes read-only GraphQL and the admin page "ERM сървър". See
[ADR 0006](../architecture/decisions/0006-erm-device-server.md) and
[ERM device server](../discocan/development.md#erm-device-server). The remaining work below needs
live evidence from a routed truck.

## Routed test trucks

CB5640XP (car 16587, unit 862129080366630, StarLink_Tracker2) and CB5636XP (car 16590, unit
862129080254620, StarLink_Scout1) have used holita as their primary server since 2026-11-03, with
Karma kept as backup `0051`/`0052`; see
[moving a unit](../discocan/development.md#moving-a-unit-between-karma-and-holita). Both relay to
Karma, Karma confirms `06` events, and neither unit authenticates with `95`.

- [ ] Decode CB5640XP's ordinary traffic: `$SLB` frames and `$SLC` containers, which the archived
      protocol does not document (it has only `$SLP`, `0182=4`). Until then erm-server mirrors them
      without a unit ID or events. Its configuration-session replies are text.

## Verify and enable primary mode

- [ ] Compare CB5636XP's decoded `ermEvent` rows with Karma `/events` and `/location` over a day.
      The deployed `ERM_EVENT_STRUCTURE` holds its `0177` layout.
- [ ] Enable `ERM_PRIMARY_UNITS` for CB5636XP, confirm that holita's confirmations stop
      retransmissions and that Karma still receives every frame; exercise the internal command API
      (`03`, `05`) and the routing restore (`04`/`46` for `0049`/`0050`) through holita.

## Replace Karma

- [ ] Standalone mode without the Karma upstream: device authentication (`95`) with the shared
      secret, a durable command queue for offline units, and eData commands (`30`) with their replies.
- [ ] Feed Fleet telemetry (status samples, trips, events) from the server instead of Karma pulls,
      then retire the Karma monitoring and Karma Client paths per truck.
- [ ] Production deployment outside the development host (process supervision, backups, TLS
      option `0053=2`, retention of raw frames and captures).
