# Karma API v2: unresolved questions and possible work

This backlog contains open investigation and proposed work, not implemented
requirements or a commitment to enable every provider feature. Current behavior,
source assets and coverage are documented in the
[Karma API reference](../discocan/erm-resources/karma-api-v2/README.md).

## ERM support verification

The [support correspondence and verification register](../discocan/erm-resources/erm-support-diagnostics-protocol-test-server/README.md)
preserve what was asked, what ERM answered, the original reply and all four images.
Manufacturer claims about Process DTCs, fault formats and Test Server forwarding
are **not live-verified by that correspondence review**. Do not turn those claims
into implemented product behaviour. Update the register when scoped evidence changes;
keep remaining actions here. ERM-TEST-01 was subsequently run as a read-only
source-contract review; its partial result is recorded below. The other stages
were subsequently started in the combined campaign linked below.

### Sequential functional verification plan

Budget updated at the user's request on **2026-10-27**: **at most 50 targeted
attempts for each stage**. ERM-TEST-01 retains its completed partial result and
20/50 used attempts; stages **02–07 are now authorized together**, to be executed
sequentially in this same run. A missing prerequisite ends only the dependent
stage; continue independent stages. No server/routing test or automated polling
continuation is authorized.

### Combined execution checkpoint

**Completed continuation, 2026-10-27:** the dated project query timed out, but
an ID-bounded read found active CAN. CB1147TP 662 was changed30→60 through Fleet
operation `bab36c8a-d2aa-4ff1-a5c0-d90b75cd3e93`, with complete independent
readback and five new periodic records at 08:23/24/25/26/27 UTC, all 60s apart.
All13 unrelated definitions match. CB1344XH DTC remains 1; CB1147TP 662 remains 60 and DTC now remains1;
CB9680TE received no new change and now has delayed539 periodic proof120/121s.
Do not repeat either completed write. Detailed IDs, source times, terminal responses
and remaining acceptance limits are in the linked campaign evidence.

The user explicitly requested this saved plan before live work. Maintain this
checkpoint after every meaningful stage transition so continuation does not
repeat commands or lose an uncertain operation. Detailed non-secret request
bookkeeping and private source captures may be kept under the ignored
`.references/review/erm-live-verification-2026-10-27/`; credentials/tokens must never
be written there. This file holds concise progress, not a polling transcript.

| Stage       | Attempts used / cap | Current state                                                                                                                                                            | Next action                                                                                                          |
| ----------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| ERM-TEST-01 | 20 / 50             | Partial source-contract result retained                                                                                                                                  | Missing portal account/current vendor corrections                                                                    |
| ERM-TEST-02 | 49 / 50             | CB1344XH diagnostic/global/version reads proved; old profile/full-parameter queues now state3 failed to receive ack                                                      | Only one attempt remains in this stage; do not replay old reads or silently reset budget                             |
| ERM-TEST-03 | 31 / 50             | VERIFIED: CB1147TP 662 30→60, independent14-definition readback, all 13 unrelated definitions identical; five new 405 records with four exact60s deltas; Gateway matches | No repeat write; keep662=60. CB9680TE passive539 proof also received,120/121s deltas; no new539 change               |
| ERM-TEST-04 | 37 / 50             | DTC byte18 0→1 verified on CB1344XH and active-CAN CB1147TP; independent49-byte readbacks;48 others identical                                                            | Leave DTC=1 on both; no repeat write. Resolve byte7 export issue and require known fault for positive-code proof     |
| ERM-TEST-05 | 33 / 50             | Four isolated logger reads returned154,0; latest56117619 combines independently enabled DTC with advancingCAN on CB1147TP; no positive fault list                        | Known-present fault with active CAN or labelled real capture; code/lifecycle/negative-response semantics remain open |
| ERM-TEST-06 | 16 / 50             | Partial: package decoder uses four-byte big-endian SPN; selected historical scans have no `419`; 56110487/88/89 still queued                                             | Reconcile those existing READs and obtain compatible known SPN/FMI evidence                                          |
| ERM-TEST-07 | 12 / 50             | Historical API/Gateway eData and all 25 raw events agree; fresh `411`/`416` also match; dated queries hit app deadline while direct reads vary                           | Address the demonstrated latency/deadline decision; keep errors distinct from empty data                             |

Execution order: 02 → 03 → 04 → 05 → 06 → 07. Before any interval write, document
one exact selected target and intended change; use the existing Fleet operation
and reconcile it rather than replaying it. Preserve all unrelated settings and
leave the actual final state explicit. CB9369PE/CB9680TE 539=120 must not be rewritten
or restored. No profile/rule/reset/ECU-clear/global-byte guesses. No UI or architecture
changes or automated test suites are part of this live campaign.

Finish with one Bulgarian report covering every stage, exact evidence/attempts,
what is proven, external versus implementation limitations, and an English
reply-ready question list for Oz. Draft the questions only; send no mail.

The [combined campaign evidence and unsent reply draft](../discocan/erm-resources/erm-support-diagnostics-protocol-test-server/live-verification-2026-10-27.md)
record the actual source measurements, submitted READs, Monitor 9.56 decoder
findings and API/Gateway comparison. The draft excludes all server topics.

On the user's subsequent instruction to finish our own tests before escalating,
the [actual DTC test](../discocan/erm-resources/erm-support-diagnostics-protocol-test-server/live-verification-2026-10-27.md#actual-dtc-read-and-controlled-configuration-test)
completed one global-only DTC change on CB1344XH. Write56116679, followed by
independent READ56116692 / message7170990372 at 2026-10-27 08:04:54 UTC,
confirmed byte 18=1 and all other 48 global bytes unchanged. **Leave DTC=1; the
one-change allowance for that phase is consumed.** The later explicit user request
authorized one DTC-only enablement on active CB1147TP:56117580, independent
56117584/message7171149727 at08:52:57 UTC,48 unrelated global bytes identical.
Logger56117619 returned154,0/message7171154531 at08:54:32, followed by405 at08:54:33.
CB1147TP DTC=1 remains enabled;662=60 was not rewritten. This closes the earlier
enabled-DTC/active-CAN test gap. No new automatic polling was started. The two CB1344XH isolated logger reads returned154,0;
Monitor's empty-buffer interpretation is not whole-vehicle health proof.
Profile/parameter read failures remain unverified and no non-global before/after
comparison is claimed. Pending acceptance now requires active CAN and a known
real fault/capture, rather than another basic toggle or duplicate logger read.

StarLink Test Server, direct receiver, forwarding, replay/simulation and all
destination/APN/transport changes remain excluded. Reading those protocol
references does not authorize exercising the server path.

| Stage       | Functionality                                                 | Main output                                                                             | Maximum attempts |
| ----------- | ------------------------------------------------------------- | --------------------------------------------------------------------------------------- | ---------------: |
| ERM-TEST-01 | Protocol access and applicable command/message definitions    | Accessible references, version scope and unresolved vendor contradictions               |               50 |
| ERM-TEST-02 | Device identity, diagnostics and complete configuration reads | Fresh evidence for a suitable target and exact preserved baselines                      |               50 |
| ERM-TEST-03 | Parameter interval update and actual periodic measurements    | One interval change, independent whole-set readback and at least three new measurements |               50 |
| ERM-TEST-04 | Process DTCs configuration                                    | Compatible flag mapping and independent proof of the intended global-setting state      |               50 |
| ERM-TEST-05 | OBD/FMS DTC reports `413`/`418`                               | Real fault/code/status evidence and resolved or precisely isolated encoding ambiguity   |               50 |
| ERM-TEST-06 | FMI/SPN report `419`                                          | Real SPN/FMI/status evidence and resolved or precisely isolated byte-layout ambiguity   |               50 |
| ERM-TEST-07 | Karma/Gateway agreement and fault interpretation              | Correlated source records, filters, state/history limits and an interface handoff       |               50 |

#### Shared execution and stopping rules

- Count each deliberate API/Gateway/portal request, device-command submission,
  queue/status read or offline protocol experiment as one targeted attempt. Log
  its number, hypothesis and expected evidence before starting it. Failed and
  uncertain requests count. Reading repository instructions and writing the report
  do not consume attempts. Do not hide retries in a batch or restart the counter
  on continuation of the same stage.
- A documented Fleet change operation is one submitted workflow, with its built-in
  preflight/write/readback. Record every resulting device queue and operation ID;
  agent-driven status reads or extra independent read submissions count separately.
  Existing worker checks do not authorize another agent submission or another write.
- The limit is a ceiling, not a target. Stop after sufficient evidence or a missing
  prerequisite. After two unchanged observations, use a different evidence-supported
  hypothesis or finish with the actual missing condition. Do not repeat empty reads
  just to exhaust the budget. No scheduled or overnight continuation.
- Before observing a live result, state a bounded UTC window and deadline based on
  the selected device's contact/cadence. Use a default maximum of 30 minutes for a
  started live stage. For delayed/asleep devices, report the pending request and
  wait for a newly authorized continuation; do not reset a used attempt budget.
- Reuse prior-stage evidence where still valid. Recheck target identity and any
  baseline required by the write contract immediately before a write. Inspect
  existing requests/operations before submitting another read. Never duplicate a
  queued read or replay an uncertain write.
- Use only the relevant authorized credential connection, privately. Do not try
  Karma credentials against the protocol portal or guess passwords. No credentials
  or session tokens in commands, output, documentation or captures.
- Each configuration stage permits at most one intentional setting change, on one
  exact target. Use the existing controlled operation when available. No profile,
  rule, reset, routing, ECU-clear or unrelated setting changes. Do not guess global
  bytes or build an arbitrary command UI to complete a test.
- Source `edt` is UTC. Preserve source IDs and values; label historical data and
  replay separately from new live data. An empty response is different from a
  timeout. Tracker voltage (`vin`/`vbat`) is not automatically eData parameter 781;
  neither voltage nor tracker contact alone proves active CAN.
- In this combined run, execute stages 02–07 sequentially. A missing prerequisite can block one stage without
  preventing independent read-only work in a later stage. Do not assume one profile
  supports both FMS and FMI, or that every vehicle has an active fault.

#### ERM-TEST-01: protocol access and source contract

**Latest result, 2026-10-27: partial; 20/50 targeted attempts used.** Public portal
reachability and the login form are confirmed. No protocol account/access email
was recovered from available sources; authentication was not submitted. Original
Outlook correspondence was located and source-level read commands/OBD sample
consistency were confirmed. `302`/`410`, `418` and `419` conflicts remain unresolved.
No Karma or device command was sent. The missing access prerequisite ends this run;
continuing this same stage retains the used budget. Findings are in
[portal access evidence](../discocan/erm-resources/starlink-online-protocol/README.md#access-evidence-from-erm-test-01)
and [diagnostic command evidence](../discocan/erm-resources/edata-simple-protocol-v4.04/diagnostics-and-fault-reporting.md).

1. Locate only the relevant stored protocol-access connection or the referenced
   support email, if available through authorized sources. Attempt normal access
   with that account; stop on missing credentials or a denied account.
2. Read the applicable device/eData command, diagnostic, global-setting, fault and
   version references. Record exact source links/sections and applicable firmware.
   Distinguish StarLink system parameters from eData definitions.
3. Compare canonical material with the supplied `302`/`410` global tables and the
   `418` ASCII / `419` SPN examples. Keep source contradictions visible; do not pick
   an encoding merely because it produces a plausible code.

**Success:** authenticated access and an attributable specification for the tested
commands/layouts, or a precise partial result identifying the missing page, version
or vendor clarification. Reading a specification does not verify live behaviour.
Map findings to ERM-PORTAL-01, ERM-COMPAT-01 and the relevant ERM-DTC rows. No device writes.

#### ERM-TEST-02: diagnostics and complete reads

1. Verify runtime/account availability and current Karma car/device identity.
   Select a small shortlist from passive freshness evidence; inspect at most three
   candidates, rather than submitting reads to the entire fleet.
2. Inspect recent tracker/eData records, then acquire only needed diagnostic,
   version, profile, complete parameter and global-setting reads. Follow existing
   queues/operations. Retain complete raw global data without guessing fields.
3. Interpret only documented `411` communication/CAN, OBD, CAN-error and ignition
   fields. Capture actual model/firmware/profile evidence where available. Do not
   infer ignition or ECU health from an empty eData result.
4. Separate tracker availability, vehicle contact/CAN availability and advancing
   measurements. Record which target can support which later stage; prefer an
   existing supported parameter and a naturally known fault where present.

**Success:** correctly correlated device responses and complete baselines, plus a
current, evidence-based eligibility result. A device with no advancing measurement
may still prove configuration reads; it is not eligible for cadence proof yet.
No writes. Update compatibility/diagnostic evidence in the relevant references.

#### ERM-TEST-03: parameter interval and real cadence

1. Use the fresh eligible target from stage 02 or re-establish it within this
   stage's budget. Prefer the previously requested CB1147TP / existing 662
   **30→60 seconds**, only if identity, profile, current baseline and advancing
   periodic data support it. Otherwise report the exact alternative target and
   change; do not silently substitute a different write scope.
2. Capture the current complete parameter set and a pre-change periodic series.
   Use raw `405` evidence where available; `407` end-of-trip reports do not establish
   periodic cadence. A stable or zero source value is valid measurement evidence.
3. Submit one controlled interval update from a complete fresh baseline. Preserve
   every unrelated definition byte and parameter ID. Inspect its built-in preflight
   and verification; use a further independent read only when necessary.
4. After independent complete readback, collect at least **three distinct new
   periodic records**, with IDs, source values, exact UTC times and consecutive
   deltas. Compare direct Karma and Gateway only for a concrete filter/access
   hypothesis. Do not interpret a timeout as an empty success.

**Success:** independently verified setting and the actual measured post-readback
cadence, including jitter or gaps; same unrelated definitions and ID set. Report
configuration success separately if runtime measurement proof is missing. Do not
rewrite/restore CB9369PE or CB9680TE's already verified 539=120 setting. Record results
in [parameter reporting](../discocan/erm-resources/edata-simple-protocol-v4.04/parameter-reporting.md)
and leave only remaining acceptance work in the settings backlog.

#### ERM-TEST-04: Process DTCs configuration

1. Establish the selected device's exact compatible flag location, command and
   readback from canonical evidence. Resolve any additional StarLink parameter
   prerequisite separately; do not apply 2069/2070 from an unrelated example.
2. Capture current global settings, profile and complete parameter definitions.
   If Process DTCs is already enabled and independently identifiable, verify it
   without toggling the flag merely to generate a write.
3. If a change is needed and within the explicitly started stage's agreed write
   scope, change only that flag once. Independently read back the full compatible
   globals and compare every unrelated byte, profile and parameter definition.
   No speculative global command or application implementation is part of this test.

**Success:** a verified flag state and preserved unrelated configuration for the
stated firmware. Actual fault transmission remains pending stages 05/06. If the
layout or safe supported command path is missing, stop before writing and specify
exactly what ERM must provide. Update ERM-DTC-01 as configuration-only or complete
runtime proof, whichever the evidence actually supports.

#### ERM-TEST-05: OBD and FMS fault reports 413 and 418

1. Locate the applicable real OBD `413` and/or FMS `418` reports through a
   demonstrated API/event path with explicit identity and bounded UTC periods.
   The source also documents a `301`/`19` fault-logger read. If needed, submit one
   such read only after confirming compatibility and inspecting existing requests;
   follow the actual response rather than assuming every family is returned.
   Do not assume `event_type=33` without evidence.
2. Match source code/status fields to a known-present fault, trusted diagnostic
   reading or a vendor-provided expected decode. Historical real reports can prove
   an observed format, but do not prove that a new configuration is working now.
3. For OBD `413`, verify the two-byte code/status layout against the real source
   and a trusted expected decode; the consistent printed example is not a live
   result. For FMS `418`, resolve the five-character representation and the printed
   `P1482` discrepancy. Keep unsupported layouts raw.
4. Confirm a real added/removed transition if one is naturally available; do not
   induce a fault or clear an ECU to manufacture a sample. Where a trusted code
   description exists, retain its source; code identity alone is not its meaning.

**Success:** supported real code/status decoding for the tested combination and
explicit evidence of the observed lifecycle subset. If there is no known fault or
canonical expected decode, leave that part unverified and name the needed ERM
sample/bench condition. Update ERM-DTC-02/04/05. No device setting writes.

#### ERM-TEST-06: FMI/SPN fault report 419

1. Select an installation/profile with actual FMI/SPN support, reusing earlier
   evidence. A profile that emits only FMS/OBD codes does not qualify by assumption.
2. Retrieve real `419` reports and compare the SPN size, endianness, padding/19-bit
   range, FMI and status with a trusted expected decode.
3. Reconcile the one-byte table claim with the example's four-byte SPN structure.
   Separate source-document correction from observed firmware/API representation.
4. Verify available fault transitions and meaning sources as in stage 05, without
   generating or clearing vehicle faults.

**Success:** real SPN/FMI/status evidence for the stated installation and an exact
layout, or the precisely isolated vendor ambiguity/missing real fault. A printed
sample alone is insufficient live proof. Update ERM-DTC-03/04. No setting writes.

#### ERM-TEST-07: API agreement, lifecycle and interface handoff

1. Reuse captured source records from the earlier stages; correlate exact IDs,
   device identity, source timestamps and original payloads between direct Karma
   and Gateway. Check bounded dates/IDs, necessary fields and applicable filters.
   Use a positive historical control when testing a filter, explicitly labelled.
2. Distinguish automatic fault reports from explicit diagnostic/configuration
   responses. Explain what triggers each, supported firmware/profile limits,
   code-description sources and remaining unanswered model requirements.
3. Separate fault-event history, added/removed status and current vehicle health.
   Missing telemetry or a removed logger entry alone is not proof of ECU clearance.
   Confirm current-state semantics only to the extent actually observed/documented.
4. Produce the UI handoff: available source fields, verified meanings, loading/error/
   empty/unsupported distinctions, configuration versus live-data confirmation and
   concrete implementation gaps. Do not implement a new fault view, ingestion or
   lifecycle persistence during the verification campaign.

**Success:** the demonstrated API-to-Gateway path preserves the verified evidence,
and every non-server question in the original request has either a scoped answer
or a precise unresolved item. Classify an unresolved item as a missing external
condition, a holita implementation issue or an ERM contract question. An absent UI
feature is not evidence of a device failure. No new device writes.

#### Required handoff after every stage

Return a concise Bulgarian report with the stage, **attempts used / applicable cap**
(50 for every stage), tested
scope and device/model/firmware/profile, operations/queues, exact UTC observations,
actual values/payload interpretation and interval/byte comparisons where relevant.
State what is proven, what failed or remains inconclusive, what the interface may
claim, and the single next necessary action. Record the final configured state and
any uncertain operation; never conceal it by starting another write.

Update the [verification register](../discocan/erm-resources/erm-support-diagnostics-protocol-test-server/README.md#verification-register)
and the relevant authoritative reference with scoped evidence. Keep failed/incomplete
parts marked **Requires further tests** and/or **Requires ERM clarification** with
an exact question and expected evidence. Retain unresolved work here; remove it when
closed. Repository check output and verbose attempt transcripts do not belong in
product documentation. A test budget cannot guarantee a firmware contract or a real
fault transition that the manufacturer/vehicle has not supplied.

### Implementation only after evidence

For a first fault view, raw source events can be inspected without pretending they are periodic eData parameters. A typed fault view should preserve car/device identity, message ID, UTC source time, report type, original payload, code or SPN/FMI, and reported status. Keep transitions and current state distinguishable; a removed event is useful history. Unknown/malformed source layouts should remain inspectable rather than being silently converted to an invented fault code.

The manual CB1344XH DTC byte 18 change now has independent whole-global readback proof. A product Process DTCs checkbox still needs an explicit, narrowly scoped Fleet-owned global-setting operation. Capture the complete compatible baseline, change only byte 18 for the demonstrated layout, and independently read it back; keep unsupported layouts opaque and the byte 7 export discrepancy separate. Reuse the existing service boundaries and persistence patterns; this mail does not require a generic command console or an architectural rewrite.

### Questions requiring ERM clarification

These are the unresolved items from the original request, sharpened by the image review. This is a preparation list, not a message that has been sent.

For the current non-server reply, use the more specific
[summary and technical-detail draft](../discocan/erm-resources/erm-support-diagnostics-protocol-test-server/live-verification-2026-10-27.md#reply-ready-questions-for-oz-server-topics-excluded),
updated after paired Monitor exports and the morning CB1344XH diagnostic/global/version reads. It separates the short request summary from the source evidence. Items 7–8 below preserve the original server
questions separately; they were not tested in the combined campaign.

1. Confirm the firmware-compatible global layout and fix the reproducible byte 7 discrepancy: the user's INI has ignition-off CAN processing=0/debounce=2, while TXT emits byte 7=02. Paired exports prove the two checkbox bytes, and a real DTC byte 18 0→1 change plus independent whole-global readback has now succeeded. Two isolated logger reads returned154,0. Ask only for remaining firmware/negative-response/known-fault behaviour, not another basic toggle example. Resolve the conflicting PDF labels and explain the two ignition-off options and any 2069/2070 prerequisite. Diagnose the actual CB1344XH ignition-on CAN error/disconnections before expecting new 539 data.
2. Explain the `418` code representation: are the five characters wire ASCII bytes, hex-rendered bytes, decimal character values in server output, or another representation? Supply a real raw report and the expected decoded code. Correct/clarify the `P1482` versus printed payload discrepancy.
3. Confirm the `419` SPN size, endianness, padding/bit rules and the corrected table. Is the example's four-byte SPN field the actual wire layout for our firmware?
4. Identify the Karma API endpoint/event mapping for `413`/`418`/`419` and the exact response to the stored-fault `301`/`19` read, including empty-buffer representation, completeness and correlation. Clarify initial snapshot versus automatic transition reporting, and supply actual identified/timestamped examples.
5. State the supported device/eData models, firmware, FMS/OBD/profile requirements, initial-versus-transition reporting behaviour, and where code meanings can be obtained. Supply the separate tracker/internal-error and command-result catalogue; a `411` CAN-error flag is not that catalogue.
6. Recover or resend the referenced `7/10/2026` protocol-access email/account and identify the applicable receiving, command, acknowledgement, checksum and diagnostic pages. ERM-TEST-01 found the matching Oz reply and public login page, but no account/access letter in the available sources. Keep credentials private, not in this Markdown file.
7. Clarify whether StarLink Test Server is a hosted service or downloadable software. Supply the actual IP/port, transport, access/installation instructions, device/fork configuration procedure, SIM/APN applicability, connection-success evidence and restoration procedure.
8. Confirm capture, replay and simulation capabilities individually, available recordings/fixtures, who acknowledges traffic, and how commands are routed while both destinations are connected.

## Device recovery

- [Restore eData reporting for CB6721TE](erm-edata-recovery-cb6721te.md) after the
  reported remote configuration changes; attempt verified remote recovery first,
  then arrange on-site work if necessary.

## eData reporting verification and restoration

- Follow up the [implemented eData configuration interface](erm-edata-configuration-interface.md)
  with measurement reporting verification, scoped restoration and production authorization.
  Provider questions below remain shared investigation items.

## Vehicle diagnostic fault monitoring

- **DTC-01:** Develop per-truck diagnostic fault monitoring. First prove end-to-end
  acquisition of a known-present ECU fault through the installed ERM/eData
  connection; then implement continuous ingestion, persistent history, tracking of
  fault status changes and notifications. Preserve captured fault evidence after
  a fault is cleared on the vehicle, and distinguish confirmed clearance from
  missing telemetry or an empty module buffer. Use the
  [ERM support verification register](../discocan/erm-resources/erm-support-diagnostics-protocol-test-server/README.md#verification-register)
  for current claim/evidence status and the [bounded plan](#erm-support-verification)
  for pending tests and specific vendor questions.

## Direct ERM telemetry

- [Build an ERM TCP receiver and test device routing](erm-tcp-receiver-and-test-device-routing.md):
  receive direct telemetry, redirect one selected test device, verify restoration,
  and determine whether it can report to both holita and Karma simultaneously.
  The task distinguishes concurrent delivery from failover and provider forwarding.

## Provider contract

- **CONTRACT-01:** Obtain the official OpenAPI/response schema or confirm its location,
  ownership and update policy. Checked public `/apiv2/` discovery addresses returned
  404; the local schema is explicitly reconstructed.
- **CONTRACT-02:** Confirm exact accepted GET array syntax, scalar/array interchange,
  repeated-key behavior and JSON-body types. Resolve GET-to-POST conversion for
  GET-only help entries and define queue multi-ID path serialization.
- **CONTRACT-03:** Obtain success/error statuses and bodies for every operation,
  including HTTP-200 errors, validation errors, permission failures and partial bulk
  success. Determine whether structured error codes and request IDs exist.
- **CONTRACT-04:** Confirm version compatibility rules, changelog, deprecation notices,
  maintenance windows, request/response limits, rate limits, retry signals and SLA.
- **CONTRACT-05:** Confirm default ordering, ID allocation/monotonicity, inclusive
  `from_id`/`to_id`, per-endpoint caps and maximum request periods, retention and
  historical export completeness. Determine whether late lower-ID arrivals occur.

## Identity, authentication and account scope

- **AUTH-01:** Confirm upstream session lifetime, idle expiry, parallel-login behavior,
  account/IP limits, revocation/logout and whether concurrent reads can invalidate
  another client's session. Determine whether a least-privilege read-only account
  is available for the current integration.
- **AUTH-02:** Decide the production identity and authorization model before relying
  on demo login. Define whether the current common-account visibility remains
  appropriate for all authenticated Tenants, without silently introducing Branch
  filtering or changing Fleet isolation.
- **AUTH-03:** Establish whether Karma projects/users/roles are account-scoped,
  their permission matrix and the relation between `project_id` and `project_ids`,
  including zero values, duplicates and cross-project visibility.
- **AUTH-04:** Determine whether NC2 and API v2 share an account, identity provider,
  permissions or sessions. The [web research](../discocan/erm-resources/karma-api-v2/web-functionality-research.md#nc2-technical-console)
  verified the saved website login and four visible NC2 destinations; it did not
  establish API-account/session equivalence. Keep the internal `/i/` interface
  separate and obtain a supported contract before depending on its source-only operations.
- **IDENTITY-01:** Establish the meaning/format/stability of `device_id`, whether it
  can be changed or reused, and whether an explicit mapping to Fleet Device.imei
  or Vehicle IDs is needed. Registration text alone is not a verified identity key.

## Time, units and telemetry semantics

- **TIME-01:** Confirm trips/profile filter timezone, account/car/user-zone precedence,
  DST behavior and date boundary inclusivity. Define whether trip filtering uses
  start, stop, containment or overlap and how open trips participate.
- **TIME-02:** Establish `edt`, `edt_tz` and `pdt` meanings, timezone and freshness
  guarantees. Confirm whether malformed calendar strings or missing timestamps
  can occur; distinguish device event, reception and processing times.
- **METRIC-01:** Obtain units/scales/calibration/reset semantics for `spd`, `odo`,
  trip duration/distance, night metrics and maximum speed, including device-specific
  variants. Do not introduce conversions or labels from field names alone.
- **METRIC-02:** Obtain the complete eData parameter dictionary, valid IDs, units,
  value types, nullable/missing behavior, precision, availability by device and
  whether descriptions are versioned/localized. Confirm multi-parameter filter
  semantics: selected readings only versus matching complete messages. The
  [observed descriptions](../discocan/erm-resources/karma-api-v2/observed-parameters.md)
  provide an initial partial reference, not model-specific definitions. The separate
  [versioned Simple eData catalog](../discocan/erm-resources/simple-edata-catalog/README.md)
  preserves the supplied EXE source records and imports vendor metadata into Fleet;
  it does not establish the Karma API mapping or device support.
- **EVENT-01:** Obtain the event-code catalog, meaning of zero, `extra` structures,
  `decode` behavior, external-device payload schemas and address-language output.
- **PROFILE-01:** Define nine category meanings, score/weight ranges, null/zero,
  weighting, aggregation, period minimums and possible extra categories. Establish
  whether any valid overall score can be displayed and how it must be calculated.
- **TRIP-01:** Establish active-trip flag values, nullable-stop conventions and whether
  active/closed trips are updated, split, merged or deleted under existing IDs.
  Assess pagination consistency against these changes.
- **SENSOR-01:** Obtain non-null `/sensors` samples and schemas: sensor identifiers,
  value types, timestamps, units, event linkage, decoding and behavior when no sensor
  readings exist. Null envelopes alone are insufficient.

## Uncovered resources and fields

- **HARDWARE-01:** Identify the exact ERM SKU, board revision and firmware of the
  [device described with EG915U-LA / LC86G](../discocan/erm-resources/erm-device-eg915u-la-lc86g/README.md).
  Obtain the referenced photographs/label evidence and official eight-contact
  pinout, supply/I/O ratings and supported accessories. Confirm the modem variant
  against required operator/route bands and establish installed CAN/eNet hardware,
  vehicle profiles and actual signal availability before assigning capabilities.
- **CAR-01:** Establish non-null schemas and meanings for `sim_imsi`, `sim_phone`,
  `karma_video_data` and `vehicle_type`; assess the need to expose each field.
- **DRIVER-01:** Obtain a nonempty driver response model and define driver identity,
  assignment/unassignment, `driver_ids` element types, permissions and deletion
  effects. Decide whether driver read views are needed before planning CRUD.
- **READ-01:** Assess whether list project/device filters, bulk telemetry selection,
  custom fields, local-time mode, address output or device decoding are needed by
  concrete Discocan workflows. Current single-truck views do not expose them.
- **WRITE-01:** Before implementing car/project/driver writes, establish required
  server validation, duplicate behavior, null/omitted update semantics, permitted
  project/device/zone changes, result schemas, audit needs and delete consequences.
  Define ownership relative to local Fleet records; no synchronization is implied.
- **PARAM-01:** Document `/parameters` definitions, cached versus device-query reads,
  value encodings, per-device availability, array alignment, partial errors,
  authorization, queue responses and verification of an applied configuration.
- **COMMAND-01:** Extend the [documented eData command evidence](../discocan/erm-resources/edata-simple-protocol-v4.04/parameter-reporting.md)
  with confirmed hardware/firmware compatibility, write permissions, acknowledgment
  correlation, delivery/expiry behavior, idempotency and accountability requirements.
  Do not generalize the verified parameter updates to every device command.
- **QUEUE-01:** Complete the queue response/state model beyond the observed
  single-ID reads and `transmitted` state: terminal conditions, expiry/cancellation,
  per-device/bulk mapping, retention and polling guidance remain unresolved.
- **ACCIDENT-01:** Obtain accident-ID discovery, report schema/encoding, sampling,
  coordinate axes, time/unit definitions, retention and permissions for
  `/black_box/{id}`. Determine how reports link to events, cars and devices.
- **PROTOCOL-01:** Recover the access email ERM identifies as `7/10/2026` and verify
  authenticated access to the separate
  [ERM protocol portal](../discocan/erm-resources/starlink-online-protocol/README.md)
  and identify the installed hardware/protocol versions. Verify the linked
  Check-sum calculation, Message confirmation, Binary protocol and large-packet
  pages against the supplied
  [Message structure reference](../discocan/erm-resources/starlink-online-protocol/message-structure.md):
  resolve the checksum byte-range discrepancy, command `00` validity, parameter
  `0001`/`0178`/`0179` rules, acknowledgment/reference semantics and exact size limits.
  Device-protocol capabilities must not be treated as API v2 endpoints.
- **PROTOCOL-02:** Verify the StarLink Test Server fork described in the
  [support correspondence](../discocan/erm-resources/erm-support-diagnostics-protocol-test-server/README.md).
  Obtain endpoints, transport, setup and ACK/command ownership; determine whether
  the offering is hosted or downloadable. Actual concurrent delivery, capture,
  replay and simulation remain unverified. The portal menu confirms this spelling
  of the earlier “StartLink Test Server” note. Establish how the separately listed StarLink Monitor
  relates to Simple eData Primitives Monitor and whether either is the product in the
  [Simple eData Monitor guide](../discocan/erm-resources/simple-edata-monitor-configuration-v1.0/README.md),
  including its executable and truck-model catalog. Determine how the
  [eData Simple 4.04 protocol](../discocan/erm-resources/edata-simple-protocol-v4.04/README.md)
  and monitor definitions correspond to API parameter IDs and whether they are
  sufficient references for a separate ingestion server.

## Adapter and verification follow-up

- **ADAPTER-01:** After provider clarification, reassess strict safe-integer/order
  assumptions, the exact-nine-category profile rule, trip date-filter verification
  and direct eData missing-car behavior against actual contracts.
- **ADAPTER-02:** Establish concrete operational needs before adding body-size bounds,
  rate-limit handling, independent login-waiter deadlines, provider diagnostics or
  other resilience mechanisms. Preserve sanitized errors and the operation budget.
- **VALIDATION-01:** Add focused adapter/GraphQL/admin fixtures only for approved
  behavior changes. Keep live credential use separate from deterministic tests;
  use dedicated database fixtures only when a change actually crosses persistence
  or service boundaries. Existing fixture coverage does not prove upstream units,
  all optional variants, completeness or write permissions.
