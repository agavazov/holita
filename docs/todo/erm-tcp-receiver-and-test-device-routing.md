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
- [ ] Register the fleet's StarLink units in holita, so units served outside Karma keep their
      identity. Use the owner's list below (2026-11-03): SIM number, ERM serial number, IMEI (the
      unit ID), model, truck, VIN and brand.
  - The list truncated CB1344XH's IMEI; it is taken from Karma, as are the Karma car IDs used to
    match existing data.
  - The SIM numbers also allow Simple SMS (`setparam`, enabled by `0592=1`) as a fallback route.

| Truck    | Karma car | IMEI            | ERM S/N | Model   | SIM number    | VIN               | Brand  |
| -------- | --------- | --------------- | ------- | ------- | ------------- | ----------------- | ------ |
| CB1344XH | 16592     | 862129080367646 | 292962  | Scout   | +359885235522 | YS2R4X200P5707045 | Scania |
| CB6721TE | 16593     | 862129080268844 | 279043  | Scout   | +359886500179 | XLRTEF5300G401471 | DAF    |
| CB2792TK | 16591     | 862129080269511 | 279042  | Scout   | +359882850311 | XLRTEF5300G408304 | DAF    |
| CB1147TP | 16595     | 862129080367299 | 279040  | Scout   | +359882927935 | XLRTEF5300G421504 | DAF    |
| CB9680TE | 16589     | 862129080332111 | 279009  | Tracker | +359884615021 | XLRTEF5300G402772 | DAF    |
| CB6711TE | 16588     | 862129080319233 | 279037  | Tracker | +359886005518 | XLRTEF5300G401304 | DAF    |
| CB5640XP | 16587     | 862129080366630 | 279038  | Tracker | +359882856252 | YV2RTY0A9RB446824 | Volvo  |
| CB9405PE | 16594     | 862129080340825 | 279041  | Scout   | +359883203752 | —                 | Volvo  |
| CB9369PE | 16586     | 862129080320033 | 279039  | Tracker | +359886001576 | —                 | Volvo  |
| CB5636XP | 16590     | 862129080254620 | 279044  | Scout   | +359886005951 | YV2RTY0A6RB446960 | Volvo  |
