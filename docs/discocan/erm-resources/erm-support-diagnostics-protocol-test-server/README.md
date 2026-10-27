# ERM support: diagnostics, protocol access and Test Server

This reference preserves the user's request to ERM and the engineer's reply about
vehicle faults/DTCs, StarLink protocol access and StarLink Test Server. It was
analysed and added to the reference library on **2026-10-27**, Europe/Sofia.
The ODT has no email header. ERM-TEST-01 later found Oz Dori's matching reply in
Outlook, received **2026-10-25 08:39:01 UTC**. That received timestamp and the ODT
export timestamp are distinct; the exact sending timestamp is not established.

**The correspondence itself is not live verification.** Subsequent tests have
verified Process DTCs configuration changes on two trucks and logger terminal responses;
a real vehicle fault-code report and lifecycle remain unproved. ERM's statements, source-document analysis and
observed device behaviour are separate evidence. This reference introduces no
application feature, device configuration change or direct telemetry receiver.

[ERM resources](../README.md) · [Original request and reply](correspondence.md) ·
[Detailed comparison and four images](analysis.md) ·
[Combined verification evidence and reply draft](live-verification-2026-10-27.md) ·
[Pending tests and ERM questions](../../../todo/karma-api-v2.md#erm-support-verification)

## Source material

| Material                  | Location and scope                                                                                |
| ------------------------- | ------------------------------------------------------------------------------------------------- |
| Engineer's original reply | [ODT source](source/erm-support-reply.odt), preserved byte-for-byte                               |
| Original request          | [Correspondence](correspondence.md#original-request), supplied separately by the user             |
| Source descriptions       | [Analysis](analysis.md), including a question-by-question comparison and the four original images |
| Provenance                | [Metadata](metadata.json): source hash, image hashes/dimensions and export-date qualifications    |

The source ODT's original filename was `karma-mail.odt`. Its SHA-256 is
`be15c82d54f09065c5bff90ccf9d2920e52e4a6c1ec2d6119c072fb0d613d17d`.
The reference is self-contained and does not depend on `.misc/` files. Portal or
device credentials are not included.

## ERM-TEST-01 source-contract result

On **2026-10-27**, the read-only stage confirmed the public portal's login page
and source-level eData read commands. Authentication remains blocked because the
actual protocol account/access email was not recovered. No device command or
Karma request was made. The stage finished with a partial result and precise
vendor questions, rather than spending the unused budget on repeated searches.

The [diagnostics and fault reference](../edata-simple-protocol-v4.04/diagnostics-and-fault-reporting.md)
adds the previously omitted **stored-fault read `301` / payload `19`** and
**OBD report `413`**. Its three printed OBD codes decode consistently. FMS `418`,
FMI `419` and global `302`/`410` contradictions remain source-level questions;
the global conflict was confirmed visually in the original PDF. None of those
source checks proves live reporting or a safe compatible Process DTCs write.

## Verification register

Initial status date: **2026-10-27**. This register covers the claims and missing
details in this correspondence. It does not invalidate earlier, separately scoped
parameter-read/write evidence or establish new periodic-measurement proof.

The subsequent [bounded stages 02–07](live-verification-2026-10-27.md) confirmed
historical periodic reception and a working direct API/Gateway positive control,
and inspected the manufacturer's Monitor 9.56 decoder without running it. Those
are scoped observations; a new interval change and real fault lifecycle remain
unproved. Device-read references and actual stopping conditions are retained there.
The new CB1147TP diagnostic/profile replies at **2026-10-26 23:51:08 UTC** were
also confirmed unchanged through Gateway: ignition off, no CAN bit, profile 343.
The combined campaign ended after **76 targeted attempts across stages 02–07**;
no setting write or scheduled continuation was started.

The subsequent [morning recheck](live-verification-2026-10-27.md#morning-recheck-paired-monitor-exports-and-cb1344xh)
adds eight preserved controlled Monitor exports plus real CB1344XH `411`, `410`
and extended `412` replies. DTC and ignition-off/CAN-alive checkbox command bytes
are now confirmed by paired exports. CB1344XH was moving with ignition on but
reported CAN error/disconnections; tracker activity does not resolve that fault.
At that morning checkpoint no live checkbox change had been made. The subsequent
[actual DTC test](live-verification-2026-10-27.md#actual-dtc-read-and-controlled-configuration-test)
confirmed one byte 18 0→1 change by independent full-global readback at 08:04:54 UTC;
all other 48 global bytes matched. DTC remains 1. Both real logger reads returned
154,0; at that checkpoint a vehicle DTC code/lifecycle and a new interval were unproved. Later interval and active-CAN DTC results follow below.

| ID            | Subject                                                       | Manufacturer/source evidence                                                         | Local verification and current status                                                                                                                                                  | Evidence needed to close                                                                                                        |
| ------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| ERM-DTC-01    | Process DTCs activation                                       | Engineer's instruction and a Process FMS DTCs field in source `302`                  | **Configuration verified on CB1344XH and active-CAN CB1147TP**: byte18 0→1, independent49-byte matches at08:04:54/08:52:57 UTC;48 others identical; positive fault list still unproved | Actual known fault report/lifecycle; byte 7 export discrepancy remains a separate vendor question                               |
| ERM-DTC-02    | FMS fault report `418`                                        | Table says ASCII; source payload does not reproduce the printed first code           | **Five character bytes confirmed in Monitor 9.56 decoder; real firmware/API report still required**                                                                                    | Corrected sample and real raw report with expected code/status                                                                  |
| ERM-DTC-03    | FMI fault report `419`                                        | One-byte SPN table conflicts with 19-bit range and four-byte sample                  | **Four-byte big-endian SPN confirmed in Monitor 9.56 decoder; installed layout/bit rules unproved**                                                                                    | Corrected specification, reserved-bit rules and real decoded report                                                             |
| ERM-DTC-04    | Faults in Karma/API                                           | Engineer confirms platform/API support without an endpoint or captured response      | **Requires further tests**; bounded CB1147TP scan found no `413`/`418`/`419`; CB6711TE coverage incomplete after timeouts                                                              | Identified vehicle/device, actual endpoint, source message ID/UTC time and known fault/lifecycle evidence                       |
| ERM-COMPAT-01 | Model, firmware and profile requirements                      | Monitor 9.08 screenshot; no compatibility specification                              | **Partial: CB1147TP profile343 and CB1344XH extended 412/global read verified; CB1344XH profile and type91 extension unresolved**                                                      | Supported hardware/firmware combinations, extended version decode and current target profile                                    |
| ERM-PORTAL-01 | Protocol access and complete exchange documentation           | Engineer refers to access email dated literally `7/10/2026`                          | **Partial: public login page verified 2026-10-27; authentication blocked by unavailable credentials**                                                                                  | Recover the account/email; verify authenticated framing/ACK/command pages                                                       |
| ERM-SERVER-01 | Simultaneous forwarding to our server and ERM Test Server     | Engineer explicitly describes a fork, without endpoint/setup details                 | **Requires ERM clarification; not live-tested**                                                                                                                                        | Actual service/tool, endpoints, transport, fork procedure, ACK/command ownership and fresh matched traffic at both destinations |
| ERM-SERVER-02 | Capture, replay and simulation                                | Original request asks for all three; reply describes only a fork and static examples | **Requires ERM clarification; not tested**                                                                                                                                             | Individual capability confirmation, usable captures/fixtures and demonstrated behaviour                                         |
| ERM-SERVER-03 | Device connection, network settings and successful connection | Different IP/port mentioned; transport/APN/configuration/readback omitted            | **Requires ERM clarification; not live-tested**                                                                                                                                        | Compatible configuration procedure, observed handshake/messages and preserved/restored production routing                       |
| ERM-DTC-05    | Explicit stored-fault read and OBD report `413`               | Protocol 2.3.16 documents `301`/`19`; its `413` example matches P1111/C2222/B3333    | **Four real isolated replies on two trucks**: includes56117619 with independently enabled DTC and advancingCAN on CB1147TP; all154,0; no positive DTC list                             | Known real fault/code list; distinguish empty-buffer versus generic rejection semantics on this firmware                        |

The two source inconsistencies are described in the [image analysis](analysis.md#images-2-and-3-fms-fault-report-418).
They are not evidence of a malfunctioning physical device. DTC enablement also does
not prove a 539/662 reporting interval or create CAN data when the vehicle supplies none.

The [completed live reporting test](live-verification-2026-10-27.md#completed-live-reporting-and-active-can-fault-control)
subsequently verified CB1147TP 662 30→60 through the existing Fleet workflow,
independent whole-set readback and five new 405 records with four exact60-second
deltas. All13 unrelated definitions were identical; Gateway matched the new IDs,
times and values. CB9680TE also supplied delayed539 periodic proof120/121s after
its earlier verified120 setting, without a new write. These are scoped measurement
successes; a real DTC code/lifecycle remains unproved. Final settings are
CB1147TP 662=60/DTC=1 and CB1344XH last verified DTC=1. The
[same-device DTC control](live-verification-2026-10-27.md#active-can-and-enabled-dtc-on-the-same-truck)
verified CB1147TP DTC enablement at08:52:57, then received154,0 at08:54:32 and
another405 at08:54:33. Enabled DTC and active CAN are now tested together; a known
fault is still required to prove positive fault-code decoding and lifecycle.

## Recording subsequent confirmations

Use these statuses consistently:

- **Not tested / not verified:** no adequate scoped observation has been collected.
- **Requires further tests:** a run is incomplete or inconclusive, including an observed
  failure whose cause has not been established. Record what failed and the missing evidence.
- **Requires ERM clarification:** a missing or conflicting vendor contract prevents a
  meaningful conclusion. Keep the precise question in the linked backlog.
- **Verified for the stated scope:** the required evidence was observed. State the tested
  model/firmware/profile, device, procedure and limitations; do not generalize fleet-wide.

The [pending functional plan](../../../todo/karma-api-v2.md#sequential-functional-verification-plan)
has seven stages, each capped at 50 targeted attempts. On 2026-10-27 the user
authorized stages 02–07 together as one sequential run; stage 01 retains its partial result.
Test Server/routing experiments remain excluded.
This changes the planned budget, not any verification status above.

After a targeted test, update the applicable row with its observation date, scope,
source message/operation/queue references, exact UTC times and a concise evidence
summary or link. Keep a configuration readback separate from actual fault/measurement
receipt. For interval proof, retain at least three genuinely new periodic measurement
IDs, source values, UTC `edt` timestamps and consecutive deltas after independent readback.
For DTC proof, retain the known fault and observed added/removed transitions where tested.
For forwarding proof, correlate fresh identified traffic at both destinations.

An empty response, timeout, queued/transmitted command, `COMPLETE` operation or Monitor
checkbox alone does not establish the corresponding runtime behaviour. A failed test
must retain its actual outcome and remain marked for further tests and/or ERM clarification;
do not silently promote an assumption to a supported feature.

Keep the source correspondence and original images unchanged. Correct analysis with
an explicit basis when new evidence resolves a discrepancy. Keep remaining actions
in the [Karma backlog](../../../todo/karma-api-v2.md#erm-support-verification), and update
the existing authoritative workflow/protocol reference when behaviour is actually
confirmed. Store credentials and unsanitized captures privately; this register is a
concise capability/evidence reference, not a polling transcript or automated-check log.
