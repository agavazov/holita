# ERM device server: test-device routing and replacing Karma

The receiver exists: [`apps/erm-server`](../../apps/erm-server) mirrors device traffic to Karma,
stores connections, frames, decoded events and holita commands, can confirm and command a device in
primary mode, and exposes read-only GraphQL and the admin page "ERM сървър". See
[ADR 0006](../architecture/decisions/0006-erm-device-server.md) and
[ERM device server](../discocan/development.md#erm-device-server). The remaining work below needs
live evidence from a routed truck.

## Verify the routed test truck

CB5640XP (car 16587, unit 862129080366630) has used holita as its primary server since 2026-11-03
(0049/0050 set through a configuration session, Karma kept as backup 0051/0052); see
[moving a unit](../discocan/development.md#moving-a-unit-between-karma-and-holita).

- [ ] Verify fresh frames from the truck in `ermFrame`, Karma confirmations passing back, fresh
      Karma data for the truck, and a reconnect after the 720 s idle timeout (`0774`).
- [ ] Record which device commands Karma confirms (`ERM_ACK_COMMANDS`) and whether the device
      authenticates with `95` (`0187`). The unit ID is the IMEI.

## Verify and enable primary mode

- [ ] Read the real event structure (`03,1,0177` and `0178`/`0179`) and compare decoded `ermEvent`
      rows with Karma `/events` and `/location` for the same period; fix `ERM_EVENT_STRUCTURE`.
- [ ] Enable `ERM_PRIMARY_UNITS` for the test truck, confirm that holita's confirmations stop
      retransmissions and that Karma still receives every frame; exercise the internal command API
      (`03`, `05`) and the routing restore (`04`/`46` for `0049`/`0050`) through holita.

## Replace Karma

- [ ] Standalone mode without the Karma upstream: device authentication (`95`) with the shared
      secret, a durable command queue for offline units, and eData commands (`30`) with their replies.
- [ ] Feed Fleet telemetry (status samples, trips, events) from the server instead of Karma pulls,
      then retire the Karma monitoring and Karma Client paths per truck.
- [ ] Production deployment outside the development host (process supervision, backups, TLS
      option `0053=2`, retention of raw frames and captures).
