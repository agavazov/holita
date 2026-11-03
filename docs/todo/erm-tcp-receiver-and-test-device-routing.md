# ERM device server: test-device routing and replacing Karma

The receiver exists: [`apps/erm-server`](../../apps/erm-server) mirrors device traffic to Karma,
stores connections, frames, decoded events and holita commands, can confirm and command a device in
primary mode, and exposes read-only GraphQL and the admin page "ERM сървър". See
[ADR 0006](../architecture/decisions/0006-erm-device-server.md) and
[ERM device server](../discocan/development.md#erm-device-server). The remaining work below needs
live evidence from a routed truck. The [fleet control plan](erm-fleet-control-plan.md) sets the
order, safety rules and test levels for all units.

## Routed test trucks

CB5640XP (car 16587, unit 862129080366630, Tracker), CB5636XP (car 16590, unit 862129080254620,
Scout) and, since 13:09 on 2026-11-03, CB6711TE (car 16588, unit 862129080319233, Tracker) use
holita as their primary server, with Karma kept as backup `0051`/`0052`; see
[moving a unit](../discocan/development.md#moving-a-unit-between-karma-and-holita). All relay to
Karma, and none authenticates with `95`. CB5640XP and CB5636XP run in primary mode and are always
connected (`0774=0`, was 720). The Tracker formats are described in
[StarLink Tracker frame formats](../discocan/erm-resources/starlink-binary-formats.md).

- [ ] Identify the remaining `$SLB` fields: tag `27`, the `ff 32` flags (ignition/engine) and the two
      middle bytes of `26`; then fill `engineOn` for binary reports.
- [ ] Record connection closes when erm-server stops: the restarts at 13:05, 13:24 and 13:48 on
      2026-11-03 left no close record in the database or the JSON Lines capture, although
      `onModuleDestroy` stops the listener and drains the capture queue. The four rows were corrected
      by hand.
- [ ] Always-connected units do not reconnect after erm-server closes their connection (13:05:
      no attempt for minutes). Keep their sessions across deployments, or wake them by a call
      to the SIM after a restart.
- [ ] Add CB6711TE to `ERM_PRIMARY_UNITS` once its ordinary sessions through holita are verified.

## Verify and enable primary mode

- [ ] Compare the routed trucks' decoded `ermEvent` rows with Karma `/events` and `/location` over a
      day. The deployed `ERM_EVENT_STRUCTURE` holds the shared `0177` layout.
- [ ] Watch that holita's confirmations stop retransmissions; on 2026-11-03 Karma kept receiving
      CB5636XP's events in primary mode.
- [ ] Consume replies to holita's commands that arrive inside a `$SLC` container: they are matched
      and confirmed, but the container still reaches Karma. Never read 0049–0054 through the API.
  - Units in a configuration session may send `E0 00` pairs at about 2 KB/s, with or without a
    confirmation from the server. erm-server's frame splitter keeps such bytes in front of the next
    frame, which then fails to parse.

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
