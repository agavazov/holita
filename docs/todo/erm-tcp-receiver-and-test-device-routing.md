# ERM device server: test-device routing and replacing Karma

The receiver exists: [`apps/erm-server`](../../apps/erm-server) mirrors device traffic to Karma,
stores connections, frames, decoded events and holita commands, can confirm and command a device in
primary mode, and exposes read-only GraphQL and the admin page "ERM сървър". See
[ADR 0006](../architecture/decisions/0006-erm-device-server.md) and
[ERM device server](../discocan/development.md#erm-device-server). The remaining work below needs
live evidence from a routed truck.

## Route the first test truck

- [ ] Point CB5640XP (car 16587) at the server: `0049=65.108.137.165`, `0050=11500`; keep the
      Karma backup `0051=54.216.224.65`, `0052=500`. Karma API v2 cannot do it: `PUT /parameters`
      rejects every wire format and `POST /commands` rejects StarLink writes (`04`, `46`) with
      `No valid car_ids`, while reads (`03`) work and use the message format `<cmd>,<ref>,<fields>`.
      Possible routes: the Karma web UI, ERM support, or Simple SMS (`0592=1` on this truck)
      `setparam#<0593>#50#11500` and `setparam#<0593>#49#65.108.137.165` to the truck's SIM.
- [ ] Verify fresh frames from the truck in `ermFrame`, Karma confirmations passing back, fresh
      Karma data for the truck, and a reconnect after the 720 s idle timeout (`0774`).
- [ ] Record which device commands Karma confirms (`ERM_ACK_COMMANDS`), whether the unit ID is the
      IMEI or the 6-hex serial (`0001`) and whether the device authenticates with `95` (`0187`).

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
