# Real fault acquisition and ten-truck verification

Campaign date: **2026-10-29**. User-facing times use Europe/Sofia (UTC+2 on this date); tables explicitly use **UTC**. [Current register](README.md#verification-register) · [Reply analysis](reply-2026-10-29.md) · [Machine-readable evidence](source/2026-10-29-diagnostic-evidence.json).

**Result: real vehicle fault data can be read through Karma and holita’s existing Gateway.** Independently retrieved CB1147TP event `7177124308` contains two added SPN/FMI records; a separate current-day event `7179721665` contains a third. Both exact raw records passed through `karmaEvents`. Fresh fixed logger requests reached five of the ten trucks and produced negative special ACKs; five remained queued at the observation cutoff. Additional fixed diagnostic reads produced five actual `411` responses. These are separate outcomes.

## Positive fault evidence through the actual project

| Source message ID | Source UTC          | Truck / car / device                   | Raw extra                                        | Decoded records                                                                             |
| ----------------- | ------------------- | -------------------------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| `7177124308`      | 2026-10-28 18:54:31 | CB1147TP / `16595` / `862129080367299` | `19,0,419,0,1,1,1001,21000010F30701000004DF0B01` | SPN **4339** / FMI **7** / status `01` added; SPN **1247** / FMI **11** / status `01` added |
| `7179721665`      | 2026-10-29 12:54:06 | CB1147TP / `16595` / `862129080367299` | `19,0,419,0,1,1,1001,2100005CFE0F01`             | SPN **23806** / FMI **15** / status `01` added                                              |

The first source record exactly matches ERM’s supplied excerpt. The second was independently discovered in the latest API batch and was not supplied in the reply. Both were independently reacquired with **`date_type=utc`**, exact message-ID boundary and matching car/device. Every record has one-byte type `21`, followed by six-byte records: four-byte big-endian SPN, FMI, status. All three statuses are `01` (added). Their authoritative descriptions, source ECU and current active state are not inferred.

At **15:02:40–15:02:41 UTC (17:02:40–17:02:41 Sofia)** the existing native Apollo Router at port 11010 forwarded two authenticated `karmaEvents` queries to a task-started Karma Client at port 11014, using the actual upstream account. Both returned `errors: []`; source message IDs, car/device, event `33`, source `edt` and `extra` matched byte-for-byte. No fixture or illustrative scenario supplied this result. The task-started Karma Client was stopped afterwards.

The request used an existing ID-bound cursor, without a date filter that had timed out during discovery. A reproducible query shape is:

```graphql
query FaultEvidence($input: KarmaEventsInput!) {
  karmaEvents(input: $input) {
    items {
      id
      carId
      deviceId
      eventId
      edt
      extra
    }
    hasMore
  }
}
```

At this campaign's cutoff, the Events UI could inspect these raw records, while a product DTC decoder and diagnostic-command workflow had not yet been implemented. The subsequent [real truck Diagnostics workflow](../../../archive/karma/development.md#real-truck-diagnostic-history) now displays them separately from the illustrative Fleet scenario. This campaign's original evidence proves acquisition and raw propagation for the identified reports, not a complete current fault inventory.

## Logger read submitted once per truck

Each car/device pair was read before submission. The exact request was:

```text
30,1,19,0,19,301,0,1,1,19
```

All ten commands were accepted with one queue ID each between **14:57:45.670 and 14:57:49.818 UTC**. The following source observations were rechecked using explicit UTC selection. The first observation sequence ended at **15:01:35 UTC**; the independent UTC recheck ended before the diagnostic requests at **15:03:59 UTC**.

| Truck    | Car / device                | Queue      | Final observed queue state  | New special ACK: message / UTC                    |
| -------- | --------------------------- | ---------- | --------------------------- | ------------------------------------------------- |
| CB9369PE | `16586` / `862129080320033` | `56182082` | 1 / transmitted             | `7180175996` / 2026-10-29 14:57:52 / `19,0,154,0` |
| CB5640XP | `16587` / `862129080366630` | `56182083` | 1 / transmitted             | `7180172853` / 2026-10-29 14:57:46 / `19,0,154,0` |
| CB6711TE | `16588` / `862129080319233` | `56182085` | 0 / queued for transmission | No new reply observed                             |
| CB9680TE | `16589` / `862129080332111` | `56182087` | 0 / queued for transmission | No new reply observed                             |
| CB5636XP | `16590` / `862129080254620` | `56182088` | 0 / queued for transmission | No new reply observed                             |
| CB2792TK | `16591` / `862129080269511` | `56182089` | 1 / transmitted             | `7180173026` / 2026-10-29 14:57:51 / `19,0,154,0` |
| CB1344XH | `16592` / `862129080367646` | `56182091` | 1 / transmitted             | `7180172986` / 2026-10-29 14:57:54 / `19,0,154,0` |
| CB6721TE | `16593` / `862129080268844` | `56182092` | 1 / transmitted             | `7180174718` / 2026-10-29 14:57:54 / `19,0,154,0` |
| CB9405PE | `16594` / `862129080340825` | `56182093` | 0 / queued for transmission | No new reply observed                             |
| CB1147TP | `16595` / `862129080367299` | `56182094` | 0 / queued for transmission | No new reply observed                             |

All five new special ACKs have message IDs greater than each truck’s captured pre-request latest-event watermark. There was one local logger request per truck, with matching car/device and the expected response family. The raw ACK does **not** echo the queue ID; temporal/source-watermark association is not a universal wire-level correlation contract. The same-second source timestamps have one-second precision.

**`19,0,154,0` is a negative acknowledgement under ERM’s new explicit definition.** The queue may still say `transmitted`. These replies demonstrate live command/response transport, not a successful empty fault read. No timeout, pending queue or absent report was converted to “no faults.” The five queue-state-0 devices are unresolved at cutoff; last-known contact is not a claim of current connectivity. No queued request was replayed or cancelled.

## Fresh diagnostics from the five responders

After the logger observation phase, the same five identified responders received exactly one distinct fixed diagnostic request each:

```text
30,1,19,0,19,306,0,1,1,
```

A fresh car/device check and pre-request message watermark preceded each request. Only newer matching `411` reports were accepted. All five queues reached state 1, `transmitted`; actual reports, rather than queue states, establish the result.

| Truck    | Diagnostic queue | Source message / UTC               | Raw report                           | Documented prefix                                  |
| -------- | ---------------- | ---------------------------------- | ------------------------------------ | -------------------------------------------------- |
| CB9369PE | `56182284`       | `7180194143` / 2026-10-29 15:04:01 | `19,0,411,0,1,1,1001,00000001010C87` | communications=00; OBD=00; CAN error=0; ignition=1 |
| CB5640XP | `56182286`       | `7180194222` / 2026-10-29 15:04:02 | `19,0,411,0,1,1,1001,00000000000001` | communications=00; OBD=00; CAN error=0; ignition=0 |
| CB2792TK | `56182287`       | `7180194176` / 2026-10-29 15:04:02 | `19,0,411,0,1,1,1001,00000000000000` | communications=00; OBD=00; CAN error=0; ignition=0 |
| CB1344XH | `56182288`       | `7180194305` / 2026-10-29 15:04:07 | `19,0,411,0,1,1,1001,00000000000001` | communications=00; OBD=00; CAN error=0; ignition=0 |
| CB6721TE | `56182289`       | `7180194390` / 2026-10-29 15:04:07 | `19,0,411,0,1,1,1001,01000001010001` | communications=01; OBD=00; CAN error=0; ignition=1 |

Under the documented first-four-byte layout, CB6721TE reports CAN communication and ignition on; CB9369PE reports ignition on with no communications bit; the other three snapshots show ignition off. CAN-error bytes are zero in these five snapshots. The trailing three bytes are preserved without guessing their extended meaning. A snapshot does not establish a permanent wiring repair or vehicle health. Collection completed at **15:04:41 UTC (17:04:41 Sofia)**.

## Final queue reconciliation

A later read-only reconciliation at **15:13:32–15:13:59 UTC
(17:13:32–17:13:59 Sofia)** rechecked all ten existing queues and UTC-selected
latest source batches. The same five queues were state 1 with the same five
negative special ACKs; the other five remained state 0, queued for transmission.
No additional logger command was sent. No new fault-list response to this run’s
requests was observed. The machine-readable evidence includes this final cutoff.

## Interface delivery recheck

At **16:46:03 UTC (18:46:03 Europe/Sofia)**, the implemented
`karmaDiagnosticHistory` query independently returned both exact source messages
through a task-started native Gateway and the real Karma Client account. The
compiled Bulgarian admin displayed message `7177124308` with SPN 4339/FMI 7 and
SPN 1247/FMI 11, then message `7179721665` with SPN 23806/FMI 15. The first
record's details retained its original payload. Each record was selected with
equal inclusive lower/upper message-ID bounds; the UI displayed UTC and
Europe/Sofia times and explicitly incomplete history. These were actual source
reads, without fixtures, and do not establish a fresh ECU scan.

A separate read-only reconciliation of the original ten logger queues found
state `1` for nine queues. Queue **56182087**, CB9680TE / car **16589**, remained
state `0`. This updates their delivery observations after the original 15:13
cutoff; newly transmitted queues were not promoted to positive ACKs or successful
fault reads. No additional device command was sent during interface delivery,
and the earlier NACK evidence remains unchanged. Delivery-check processes were
stopped and temporary login sessions remained memory-only.

## Method, final state and limits

- Three completed direct-API sequences used **153**, **53** and **21** bounded requests, including discovery, identity, queue and source reads. Before them, two date-filtered event reads timed out and one further read was interrupted; that prepass sent no device commands. Two separate Gateway queries reused actual source IDs.
- The campaign sent exactly **15 read-only device requests**: ten logger reads and five diagnostic reads. No accepted command was automatically retried. The supplied bulk globals/parameters/profile recipe was not applied.
- No setting, interval, profile, rule, reset, logger-clear, vehicle-clear, odometer, counter, APN, transport or server-destination change was submitted. No fault was induced or cleared. Previously recorded settings were not freshly read back here; manufacturer changes described in the new reply are separate.
- Latest batches contain at most 500 events per truck and were deliberately marked incomplete. No complete history or fleet-wide absence-of-faults claim follows. Five unresolved queues can deliver later; their IDs above remain the reconciliation points.
- The positive `419` events predate these requests. They prove received fault records through API/Gateway, **not** that this run’s `301`/`19` returned a fault list, initiated a fresh ECU scan or established a complete current fault inventory.
- No actual OBD `413` or FMS-character `418` report, removed transition, authoritative fault-description dictionary, direct TCP receiver, dual-server forwarding or replay/simulation behaviour was verified. See the [protocol reading guide](../starlink-online-protocol/authenticated-reading-guide.md) for source definitions and [pending work](../../../todo/erm-roadmap.md#questions-for-erm).

The task’s temporary API sessions were memory-only. Sanitized evidence retains only relevant identifiers, times, commands and payloads; no account credential, session, bearer token or private transcript is included. Application-check results belong in the task handover, not this device-evidence record.
