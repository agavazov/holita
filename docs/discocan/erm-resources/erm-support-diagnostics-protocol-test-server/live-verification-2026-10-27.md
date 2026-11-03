# ERM verification campaign: 27 October 2026

**Historical campaign (27 October).** [Current evidence from 29 October](live-verification-2026-10-29.md) independently proves positive 419 reception and corrects 154,0 to command not acknowledged. The dated observations below are preserved; absence of a fault report in this campaign is not the current capability assessment.

Analysis date: **2026-10-27, Europe/Sofia**. The initial night phase uses **UTC on
2026-10-26**; later sections explicitly use **2026-10-27 UTC**. This campaign follows the [saved bounded plan](../../../archive/karma/karma-api-v2.md#sequential-functional-verification-plan)
for ERM-TEST-02–07, each capped at 50 targeted attempts. ERM-TEST-01 retains its
earlier 20/50 partial result. No Test Server, destination, APN, transport, replay,
simulation or direct-receiver experiment is included. No support message was sent.

**Later evidence:** the [morning recheck](#morning-recheck-paired-monitor-exports-and-cb1344xh)
adds the user's paired checkbox exports and actual CB1344XH diagnostic/global/
version responses. It supersedes broad claims that a current truck was unavailable,
that the DTC command bytes are unknown, or that ignition-off reporting is universally
impossible. The earlier observations below retain their exact time and scope.

**Current configured state:** the subsequent [actual DTC test](#actual-dtc-read-and-controlled-configuration-test)
enabled only Process DTCs byte 18 on CB1344XH and independently read back all 49
global bytes. DTC remains **1**; all other 48 global bytes matched. Real logger
reads before and after returned `19,0,154,0`; no actual vehicle DTC code or fault
lifecycle is proved. Earlier no-write statements describe the earlier phases only.

**Latest result:** the [completed live interval test](#completed-live-reporting-and-active-can-fault-control)
changed CB1147TP 662 **30→60 seconds**, independently verified all 14 definitions,
and received **five genuinely new periodic measurements with four exact60-second
deltas**, also matched through Gateway. CB9680TE now has three new539 periodic
records at120/121-second deltas after its old verified120 setting. These later
results supersede the earlier missing-measurement prerequisites. Final settings:
**CB1147TP 662=60; CB1344XH DTC=1; no new CB9680TE change.**

**Latest DTC result:** the [same-device active-CAN test](#active-can-and-enabled-dtc-on-the-same-truck)
enabled CB1147TP DTC=1, independently matched all49 global bytes at08:52:57 UTC
and received logger `154,0` at08:54:32, followed by a new405 at08:54:33. This closes
the earlier enabled-DTC/active-CAN test gap; a positive fault-code list remains unproved.
**CB1147TP DTC=1 and662=60; CB1344XH last verified DTC=1.**

## What this campaign establishes

The authorized Karma account exposes ten cars in project **3611 / RentalSofia_Fleet**.
Direct API access works. The initially unavailable local Gateway and its required
services were started through the existing development scripts. Fleet device
dispatch and configuration writes were explicitly disabled while existing
operations were inspected. No setting write was submitted in that initial night phase.

The principal target is **CB1147TP**, `car_id=16595`,
`device_id=862129080367299`, Karma label `StarLink_Scout6`. A second, read-only
candidate is **CB6711TE**, `car_id=16588`, `device_id=862129080319233`, label
`StarLink_Tracker3`. These labels do not independently identify the attached eData
hardware. Current profile/version/diagnostic reads are recorded below.

At the start, explicit recent 30-minute parameter reads for CB1147TP, CB1344XH
and CB6711TE returned HTTP 200 with `[]`. A later project-wide recent read timed
out; it does not establish that all ten trucks lacked data. Tracker contact alone
is not evidence of active CAN, ignition state or a current fault.

## Actual periodic measurements: historical positive control

CB1147TP has real parameter **662**, described by Karma as **Engine Fuel Rate
(L/h)**, not engine RPM. Values below are unchanged source values; no additional
scaling is inferred.

| Message ID | UTC `edt`, 2026-10-26 | Source value for 662 | Raw report | Delta from previous periodic record               |
| ---------- | --------------------- | -------------------- | ---------- | ------------------------------------------------- |
| 7169458129 | 18:40:00              | 0                    | `405`      | —                                                 |
| 7169458308 | 18:40:30              | 0                    | `405`      | 30 s                                              |
| 7169458408 | 18:41:00              | 0                    | `405`      | 30 s                                              |
| 7169458480 | 18:41:30              | 0                    | `405`      | 30 s                                              |
| 7169458673 | 18:41:36              | 0                    | `407`      | End-of-trip record; excluded from periodic deltas |

The direct dated `/edata` read returned these five records. The source `/events`
records match the same car/device, message IDs and timestamps; their observed
Karma event code is `33`. A successful Gateway read without dates returned the
same measurement identities/values. This proves reception and the reading path
for this historical series. It does **not** prove a new 30→60-second change.

The explicit current CB1147TP query for **22:55:57–23:25:57 UTC** returned HTTP
200 `[]`. A write gate requires fresh, advancing periodic data and a fresh complete
baseline. Historical data does not satisfy that gate. Existing 539=120 settings
on CB9369PE and CB9680TE were neither rewritten nor restored.

## Submitted fixed READs

These use `POST /commands` solely to request data. No reset, logger/ECU clear,
profile change or global-setting write was sent. Queue transmission is distinct
from receiving an identified device response. Inspect these IDs before any
future read; do not duplicate an accepted pending command.

| Car      | Read / expected report                       | Queue    | Submission UTC, 2026-10-26 |
| -------- | -------------------------------------------- | -------- | -------------------------- |
| CB1147TP | Diagnostic `306` → `411`                     | 56110386 | 23:25:02.548               |
| CB1147TP | Version `308` → `412`                        | 56110387 | 23:25:02.644               |
| CB1147TP | Profile `301` / `1F` → `416`                 | 56110388 | 23:25:02.727               |
| CB1147TP | Globals `303` → `410`                        | 56110389 | 23:25:02.800               |
| CB1147TP | Complete parameters `301` / `0702BC` → `401` | 56110390 | 23:25:02.879               |
| CB1147TP | Fault logger `301` / `19`                    | 56110479 | 23:30:08.618               |
| CB6711TE | Diagnostic `306` → `411`                     | 56110487 | 23:32:41.977               |
| CB6711TE | Version `308` → `412`                        | 56110488 | 23:32:42.410               |
| CB6711TE | Profile `301` / `1F` → `416`                 | 56110489 | 23:32:42.705               |

The CB1147TP observation window begins at 23:25:02 UTC and ends at **23:55:02
UTC**. Its last verified prior tracker message was `7170058216`, 22:46:34 UTC.
The hourly spacing of earlier tracker contacts is only an observation, not a
delivery guarantee. The campaign must finish with the actual bounded outcome.

At the final queue checks, **23:54:53.888–23:54:55.343 UTC**, all six CB1147TP
READs were state **1 / transmitted**. At **23:54:55.611–23:54:56.185 UTC**, all
three CB6711TE READs remained **0 / queued for transmission**. No command was
resubmitted. Transmission time itself was not supplied by those status reads.

The final CB1147TP event read observed these new, matching-device records:

| Message ID | UTC `edt`, 2026-10-26 | Actual response / interpretation                                                                                                                               |
| ---------- | --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 7170144170 | 23:46:34              | Tracker `0,2`; no CAN/ignition meaning inferred from this payload                                                                                              |
| 7170144552 | 23:51:08              | `19,0,411,0,1,1,1001,0000000000000A`: documented prefix `00000000`, CAN bit absent, OBD mask 0, no reported CAN error, ignition 0/off; extension uninterpreted |
| 7170144588 | 23:51:08              | `19,0,416,0,1,1,1001,1F0157`: complete one-part profile **343 / 0157**                                                                                         |

These correlate by car/device, response family and the request window, not a
proven one-to-one queue acknowledgement. The final current 662 read returned
HTTP 200 `[]`; the separate CB6711TE response read also returned HTTP 200 `[]`.
Observation ended at **23:55:34.034 UTC**. This fresh diagnostic establishes a
current missing CAN/ignition prerequisite for CB1147TP, rather than inferring it
from an empty measurement list.

One final late-response reconciliation at **23:56:46.820 UTC**, restricted to
messages after `7170144588`, returned HTTP 200 `[]`. It did not restart the live
stage or submit any command. No complete `401`, raw `410`, `412` version or
attributable logger terminal/fault response was obtained. Their transmitted
queues remain references for future reconciliation, not successful readbacks.

Existing Fleet reads `e20c7d8a-1b8a-4c05-a313-76ea5fbd06db` / queue `56085932`
and `c465039e-d845-474b-be8d-e990e451e3a5` / queue `56080777` were already
`TIMED_OUT`; neither is a fresh complete baseline. No interval update operation
was found for this target in the inspected operation list.

## Process DTCs: stronger package evidence, still no compatible write proof

The supplied **Monitor 9.56** executable was inspected as PE/.NET metadata and
CIL; it was not executed. SHA-256:
`01dd13e50c55fdf84078ce298bde72320d55bee458baa4c0d2a06fca7c0ca1a0`.

`Global_Params_Struct.Update_Params_Values` (RVA 275488) reads
`Process_FMS_DTCs` as one byte at offset **18**. Its
`Get_Params_As_Binary_List` (RVA 235044) also serializes that field at offset 18.
Offsets here count from the first configuration-ID byte of the global-data
structure, excluding any outer report/header/type byte. This corroborates a
specific package layout; it does not establish the installed firmware contract,
the complete installed-firmware value semantics or a safe write for every model.
`Get_Global_Parameters_Object_From_GUI` (RVA 302016) assigns the checkbox's
`Checked` value directly, producing 0/1, while the reverse GUI mapping treats a
nonzero field as checked. This is the package's checkbox behaviour; preserve
unexpected source values until their firmware meaning is confirmed.

There is an additional concrete package discrepancy: the parser maps offset
**7** to `Process_Canbus_When_Ignition_Off`, while the serializer emits
`Debounce_Time_For_Ignition_Off` at that position. The neighbouring parser and
serializer fields agree on the preceding CANBUS #1 baud position. This is a
static implementation observation, not an observed device defect. It strengthens
the need for a canonical matching export and independent readback before sending
a whole global structure. No `302` write was attempted.

## Fault formats: what Monitor 9.56 actually parses

`Process_Recieved_Fault_Codes` (RVA 307420) accepts report families `413`, `418`,
`419` and also `422`. The latter is outside this campaign's verified contract.
The relevant branches use these layouts after the report parser has extracted
the binary fault data:

| Report | Package parser behaviour                                                      | Remaining limitation                                                                    |
| ------ | ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `413`  | Two code bytes followed by one status byte                                    | Real target report and trusted code/description still required                          |
| `418`  | Five bytes converted individually with `Convert.ToChar`, then one status byte | The printed source example remains inconsistent; firmware/API representation unobserved |
| `419`  | Four-byte big-endian SPN, one-byte FMI, one-byte status                       | Reserved/19-bit rules and installed compatibility remain unconfirmed                    |

`Get_Next_String_Data` (RVA 255152) performs the byte-to-character conversion.
`Get_Next_Data` (RVA 256396) accumulates each next byte as
`result = byte | (result << 8)`, establishing big-endian order in this package.
Thus the PDF's one-byte SPN table is contradicted by both its sample structure
and the manufacturer's own four-byte decoder. Do not silently repair the original
source or label this as live firmware verification.

The Monitor's fault-loader branch displays "no fault codes in the device buffer"
for its special NCK and waits on its special ACK. That is a package-specific
buffer interpretation, not proof of current ECU health and not a universally
verified queue acknowledgement. The source `301`/`19` request is distinct from
automatic transition reports. Unknown status bytes must remain raw; the package's
fallback display does not establish their documented meaning.

## Actual fault-search coverage

Four unfiltered CB1147TP `/events` pages covered **1,686 returned events**, from
message `7167870498` at **10:39:31 UTC** through `7170058216` at **22:46:34 UTC**,
using advancing source ID bounds. None contained `413`, `418` or `419`. This is
bounded evidence of no such reports in that returned series, not a fleet-wide
fault-free conclusion. The scan was not restricted to an assumed fault event code.

For CB6711TE, the first 500-event historical page covered **04:38:06–09:07:21
UTC**. It included diagnostic message `7167076417` at **06:21:57 UTC**:
`19,0,411,0,1,1,1001,01000001010C91`. Only documented prefix `01000001` is
interpreted: CAN bit present, OBD mask 0, CAN-error byte 0, ignition 1. Trailing
bytes remain uninterpreted. This is historical active-CAN evidence.

Complete historical `401` message `7167078313`, **06:22:29 UTC**, held ten
definitions, each with a 180-second interval: IDs 539, 188, 1, 687, 64, 785, 1657,
152, 5 and 2. It is not a fresh write baseline. Two later bounded event reads
timed out at 18 seconds, including an ID-bounded variant; coverage after the first
page is incomplete for unfiltered events. A separate narrower query using the
observed CAN event code `33` succeeded in **16.072 seconds** and returned 64
records from **09:08:46–16:46:39 UTC**: 54 `405`, seven `407` and three other
payloads, with no `413`/`418`/`419`. This improves coverage for that selected code;
it does not prove that all fault families always use code `33` or establish
absence from every event code for the whole day.

## API/Gateway comparison and interface consequences

API version returned **2.26.1.1**. The app's configured API identity was privately
compared with the authorized API connection and matched. No credentials are
included here. Basic Gateway version/location reads work; the historical undated
662 read preserves the source measurement IDs, UTC times and values.

An additional successful Gateway `karmaEvents` read returned 25 source events in
**0.820 seconds**. All 25 matched previously captured direct records by ID/device,
with byte-for-byte unchanged `extra`; the set includes the four periodic records
and end-of-trip record listed above. Raw event payload transport is therefore
demonstrated independently of the eData projection for this positive control.

A final Gateway read also returned the fresh diagnostic `7170144552` and profile
`7170144588`, both at 23:51:08 UTC, with the same identity and exact raw `extra`
as direct Karma. That request took **0.690 seconds**. The new read responses are
therefore not being lost by Gateway's raw-event projection.

The Gateway historical dated eData request returned `SERVICE_UNAVAILABLE` after
about **8.03 seconds**. One direct query for the same historical window returned
the five records in **9.314 seconds**; another direct query timed out at **20.039
seconds**. These observations demonstrate variable/slow upstream date queries and
an application deadline shorter than at least one successful upstream response.
Changing query-key order has not been established as the cause or a reliable fix.
An ID-bounded direct historical read returned 500 records in **1.396 seconds**.
It is another working read path, not proof of an unrestricted complete history.

For the other implementation session:

- Display catalog, returned configuration and actual measurements separately.
  Configuration `COMPLETE` can establish a readback, never measured cadence.
- Preserve source message/device IDs, UTC `edt`, original values and raw payload.
  Do not label 662 as RPM or derive eData 781 from tracker `vin`/`vbat`.
- Keep loading, successful empty, timeout/provider error, pending command and
  unsupported/unknown format distinct. A failed refresh must not become "no data".
- Keep periodic `405` records separate from end-of-trip `407` when computing
  intervals. The four historical zero values above are valid observations.
- Keep fault event history and added/removed logger status separate from a current
  vehicle-health claim. No real `413`/`418`/`419` sample or lifecycle was proved.
- The observed dated-query deadline deserves a focused implementation decision:
  coordinate Karma Client/Router/caller budgets or use a demonstrated bounded
  source-ID workflow where its contract supports it. An unlimited timeout, silent
  fallback or key-order workaround is not established by these tests.
- Diagnostics/version/globals and typed DTC decoding remain outside the existing
  narrow configuration API. Implement only after firmware/layout evidence closes
  the listed gaps; this campaign changes no UI, public contract or architecture.

## Bounded outcome and next action

This subsection records the **initial night phase's** bounded outcome. Later
morning/DTC/live-reporting sections supersede its pending conditions and no-write
status; retain the original times rather than treating them as current blockers.

Final response reconciliation and per-stage attempt totals are recorded in the
[execution checkpoint](../../../archive/karma/karma-api-v2.md#sequential-functional-verification-plan).
The next live write requires fresh advancing periodic data, fresh profile and a
complete same-device baseline. A real known fault or vendor-labelled capture is
required for fault-format/lifecycle acceptance. Additional empty reads cannot
replace either prerequisite.

**The live 662 30→60-second test is not proved and no interval write was sent.**
The fresh diagnostic/profile read succeeded; full definitions/globals/version and
a known real fault response were not established in that observation window.
There is no before/after unrelated-byte comparison to claim, because the write
gate did not open. No ECU/logger clear, global/profile/rule change or other device
setting write was sent. No scheduled continuation was created.

| Stage       | Attempts / cap    | Actual outcome                                                                                      |
| ----------- | ----------------- | --------------------------------------------------------------------------------------------------- |
| ERM-TEST-01 | 20 / 50, retained | Public portal/source contract partial; account unavailable                                          |
| ERM-TEST-02 | 30 / 50           | Fresh diagnostic and profile read proved; complete baseline/version/globals missing                 |
| ERM-TEST-03 | 4 / 50            | Historical cadence proved; new write blocked by current CAN/measurement prerequisite                |
| ERM-TEST-04 | 7 / 50            | Package offset/value evidence and concrete discrepancy; no compatible global write proof            |
| ERM-TEST-05 | 7 / 50            | Source decoder and bounded actual search; no real known fault/logger result                         |
| ERM-TEST-06 | 16 / 50           | Package SPN layout confirmed; no real `419`, candidate reads still queued                           |
| ERM-TEST-07 | 12 / 50           | Historical and fresh source/Gateway agreement; dated-query latency/deadline limitation demonstrated |

There were **76 targeted attempts across stages 02–07**, not 50 repetitions per
stage. Each stage stopped on sufficient scoped evidence or a concrete missing
prerequisite. Unused budget is not a reason to continue empty polling.

Next live action: inspect the existing queue/response references first. With the
same truck available on ignition and advancing `405` values, obtain a fresh
complete Fleet baseline, then perform the one authorized 662 update and independent
whole-set readback, followed by three new periodic records. For DTC tests, first
resolve the matching global layout and obtain a compatible known-fault condition
or vendor-labelled real capture. Repeating the same empty reads is not an
alternative prerequisite.

## Coverage of the original non-server questions

| Original question                              | Answer supported now                                                                                                                                                                            | Still required                                                                                                                 |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Read diagnostic information and vehicle faults | Exact fixed diagnostic/version/global/profile/definition/logger read strings are attributable to supplied sources; historical `411` CAN/ignition prefix and working periodic `405` are observed | Current response reconciliation; actual known DTC from a compatible installation                                               |
| Automatic reporting or commands                | Manufacturer describes automatic fault processing; source separately provides `301`/`19` for stored logger contents                                                                             | Installed-firmware trigger, snapshot/transition and empty-buffer semantics; enabling the checkbox alone is not reception proof |
| Commands, message formats and examples         | Source OBD example is consistent; actual Monitor decoder supports five character bytes for `418` and four big-endian SPN bytes for `419`                                                        | Corrected source examples, real raw fault/code/status pairs and separate internal-error/result catalogue                       |
| Model, firmware and configuration requirements | Karma identities are verified; historical parameter set/diagnostic scope and package version are recorded                                                                                       | Exact physical module/extended version compatibility, fresh profile and canonical globals/requirements                         |
| Protocol credentials and relevant pages        | Public login page reachable; matching Oz reply found in the earlier stage                                                                                                                       | Private access email/account and current authenticated documentation                                                           |

The server/software, forwarding, connection configuration, capture, replay and
simulation questions remain in their separate original register and backlog.
They are intentionally absent from the reply draft below and were not exercised.

## Morning recheck: paired Monitor exports and CB1344XH

The user identified CB1344XH as active in Karma and supplied four paired INI/TXT
exports on **2026-10-27**. The primary controlled night attempt used CB1147TP;
there were also passive checks on CB1344XH/CB6711TE and earlier fleet diagnostics.
A negative night snapshot does not establish morning availability. The following
new observations are read-only; no exported command list was executed.

### Exact export differences

The eight source files are preserved byte-for-byte under
[Monitor exports](source/monitor-exports/dtc-disabled.ini), with descriptive names
and hashes in [metadata](metadata.json). The producing program version is not
embedded in these exports; do not infer it from the earlier inspected 9.56 binary.

| Controlled comparison                                                                                                                                                | INI field change                                  | Only changed global-data byte |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- | ----------------------------- |
| [DTC disabled](source/monitor-exports/dtc-disabled.ini) → [enabled](source/monitor-exports/dtc-enabled.ini)                                                          | `PROCESS FMS DTCs=0` → `1`                        | Offset **18**, `00` → `01`    |
| [Ignition-off reporting disabled](source/monitor-exports/ignition-off-reporting-disabled.ini) → [enabled](source/monitor-exports/ignition-off-reporting-enabled.ini) | `SEND PARAMS WHILE IGN OFF AND CAN ALIVE=0` → `1` | Offset **24**, `00` → `01`    |

Offsets start at the first configuration-ID byte, after the last comma in `302`.
Each TXT contains a **49-byte** global payload and **28 commands**. All other
27 commands and all unrelated global bytes match within each controlled pair.
The DTC-disabled and ignition-off-reporting-disabled files are identical, separately
for INI and TXT. This is generated-command evidence, not an applied device change.

The paired [TXT sources](source/monitor-exports/dtc-enabled.txt) also independently
reproduce the earlier offset-7 concern: INI says `PROCESS CAN IGNITION OFF=0` and
ignition-off debounce is `2`, but the generated `302` byte 7 is **02**, not **00**.
Toggling the later send-while-ignition-off checkbox changes byte 24; it does not
correct byte 7. Ask ERM which field/value and tool version are canonical.

The checkbox explicitly includes **AND CAN ALIVE**. The earlier general statement
that no eData can be sent with ignition off was too broad. The supplied package
supports requesting that behaviour. Its interaction with separate ignition-off
CAN processing, source availability and installed firmware still needs runtime
proof; the checkbox itself does not establish active CAN or fresh measurements.

The TXT exports also contain profile changes, deletes, resets and ECU/logger clear
commands. They are reference command lists, not safe scripts to replay as a whole.

### Current target and source evidence

Direct API identity: **CB1344XH**, car **16592**, device **862129080367646**,
project **3611**, Karma label **StarLink_Scout3**. Tracker records have advancing
times and changing coordinates, including `7170888942` at **07:32:40 UTC**. That
supports tracker activity/movement, separately from eData CAN availability.

| Message ID | UTC `edt`, 2026-10-27 | Actual source evidence                                 |
| ---------- | --------------------- | ------------------------------------------------------ |
| 7170893692 | 07:33:59              | `19,0,417,0,1,1,1001,`                                 |
| 7170893865 | 07:34:14              | `19,0,411,0,1,1,1001,00000101010C80`                   |
| 7170895809 | 07:35:00              | Complete single-part raw global report `410`, 49 bytes |
| 7170896285 | 07:35:02              | Another `417` CAN-disconnection report                 |
| 7170900957 | 07:36:14              | Another `417` CAN-disconnection report                 |
| 7170901092 | 07:36:29              | `19,0,412,0,1,1,1001,0638010291066DFF49`               |

Protocol [section 3.17](../edata-simple-protocol-v4.04/content.md#pdf-page-27)
defines `417` as ignition on with no CAN messages for 500 ms. The documented
`411` prefix **00000101** independently means communication mask 0, OBD mask 0,
CAN-error byte 1 and ignition 1/on. Trailing `010C80` is not interpreted. Repeated
reports support an actual CAN communication problem at those times; they do not
identify whether wiring, the vehicle interface, configuration or another cause
is responsible. They are not an ECU DTC or a fault-code diagnosis.

The extended `412` first five bytes are software major/minor **06 / 38**, hardware
major/minor **01 / 02**, type **91** (hex bytes). Keep the full raw report; the
type/extension is not fully covered by the supplied five-byte example. Do not
invent a physical SKU or decode trailing `066DFF49`.

The `410` payload is:

```text
03E903E8010208000101000000000003130100000303010000000000000000000000000000000000000000000000000000
```

Under the export/Monitor layout it has DTC byte 18=**00**, ignition-off/CAN-alive
reporting byte 24=**00**, ignition-off CAN processing byte 7=**00**, CAN baud byte 6=
**08**, and maximum message size **1000**. This read is stronger than guessing
installed state from an offline INI. The user-provided enabled-DTC export is **not**
a one-byte patch of this live baseline: bytes **2, 3, 7, 11, 12, 13 and 18** differ,
including message size, the offset-7 discrepancy, silent-mode fields and OBD mode.
No such export was transmitted.

The explicit **07:03:27–07:33:27 UTC** 539 query returned HTTP 200 `[]`. The same window
without a parameter filter returned one record: `7170805995`, **07:04:29 UTC**,
parameter **785=92**, Karma description **Fuel Level (%)**. The undated positive
control returned 500 records ending at that same source record; this is a returned
window, not whole-history completeness. A separate CB1147TP 662 control for **07:16:22–07:36:22 UTC** also returned HTTP 200 `[]`. No fresh advancing 539 series was established in
this recheck; no claim about every truck in the account is justified.

Current read submissions, all on CB1344XH and all on **27 October UTC**:

| Read                                 | Queue    | Submission   | Observed response                                                                      |
| ------------------------------------ | -------- | ------------ | -------------------------------------------------------------------------------------- |
| Diagnostic `306`                     | 56116165 | 07:34:08.472 | `411` at 07:34:14                                                                      |
| Globals `303`                        | 56116170 | 07:34:54.592 | `410` at 07:35:00                                                                      |
| Version `308`                        | 56116190 | 07:36:22.272 | `412` at 07:36:29                                                                      |
| Profile `301` / `1F`                 | 56116206 | 07:36:59.894 | No complete reply observed; state 2 / transmitted, waiting for ack at 07:39:22.093 UTC |
| Complete parameters `301` / `0702BC` | 56116223 | 07:37:53.789 | No complete reply observed; state 0 / queued for transmission at 07:39:22.204 UTC      |

No request was duplicated. At **07:42:04.879 UTC**, the final subsequent-events
read returned HTTP 200 `[]`. A separate final `/location` check at **07:42:33 UTC** still returned
message `7170901092`, source time **07:36:29 UTC**, with source `spd=77.4`.
Thus both paths agreed on the latest available source watermark; the empty
subsequent-events read was not evidence that Gateway had discarded replies.
The currently installed profile/parameter definitions remain unconfirmed in this
recheck. The offline profile 343 must not be substituted for that missing response.

This recheck used **23 additional targeted attempts**, with no setting writes or
test suites. Cumulative stage counts are 02 **46/50**, 03 **8/50**, 04 **10/50**,
05 **7/50**, 06 **16/50**, 07 **12/50**; stage01 retains **20/50**. Previous night
results and their original 76-attempt total above remain historical evidence.

### Claims to keep, change or remove from the email

- **Remove “we do not know the DTC toggle command bytes.”** The paired export
  establishes byte 18 `00`/`01`. Ask about firmware applicability, preservation and
  the precise offset-7 discrepancy instead.
- **Remove a universal “ignition must be on for any eData.”** The separate byte 24
  option explicitly covers ignition off with CAN alive. Ask for its exact
  prerequisite/interaction and actual runtime behaviour.
- **Keep the observed CAN availability problem, now with concrete ignition-on
  evidence on CB1344XH.** A moving/active tracker can coexist with CAN error 1 and
  disconnection reports. Ask ERM for the correct diagnostic/recovery procedure.
- **Qualify missing-read claims by target and time.** Fresh `410` and `412` reads
  succeeded on CB1344XH. The night CB1147TP reads lacked replies in their observed
  window; a later scan returned its first 500 subsequent events only, so it did not
  establish the absence of all possible later replies.
- **Keep real fault-format/lifecycle and compatibility questions.** No actual
  labelled `413`/`418`/`419` was proved, and no DTC activation was performed.
- **Keep the dated-query latency as an application limitation, not an established
  device defect.** Today's basic reads were fast; the night timing observations
  remain valid for their specific queries. Our eight-second deadline is ours to
  address.

## Actual DTC read and controlled configuration test

The user explicitly requested that we complete our own available tests before
escalating to ERM. The previously authorized ERM-TEST-04 permitted one intentional
Process DTCs change. This phase first performed an isolated real logger read,
then refined the global-only test to use a fresh complete **49-byte global baseline**.
The profile/full-parameter reads had failed to receive ACK; their contents were
not used to construct the global command. Preservation proof below is limited to
all global bytes. No independent profile/parameter/rule before/after comparison
is claimed and no such write was submitted.

All times below are **2026-10-27 UTC**. Target remains **CB1344XH / car 16592 /
device 862129080367646**.

| Step                                          | Queue        | Request UTC      | Source response                                                                            |
| --------------------------------------------- | ------------ | ---------------- | ------------------------------------------------------------------------------------------ |
| Isolated stored-fault READ, `301` / `19`      | 56116505     | 07:54:08.928     | `7170957590`, 07:54:20: `19,0,154,0`                                                       |
| Full global preflight READ, `303`             | 56116569     | 07:59:33.341     | `7170974483`, 07:59:46: complete `410`, byte 18=0                                          |
| Refreshed full global preflight READ          | 56116668     | 08:02:38.173     | `7170983813`, 08:02:46: complete `410`, byte 18=0                                          |
| **One Process DTCs write**, `302`             | **56116679** | **08:03:52.548** | Queue transmitted; `154,1` at 08:04:00 retained without treating it as verification        |
| Independent full global READ, `303`           | **56116692** | 08:04:39.632     | **7170990372, 08:04:54: complete `410`, byte 18=1; entire payload equals intended output** |
| Isolated stored-fault READ after verification | **56116699** | 08:05:14.999     | **7170992553, 08:05:20: `19,0,154,0`**                                                     |
| Diagnostic context READ, `306`                | 56116715     | 08:06:43.792     | `7170996746`, 08:06:50: `19,0,411,0,1,1,1001,00000000000002`                               |

The first complete preflight became 132 seconds old during preparation. The
freshness gate stopped before any write marker/submission. One fresh READ was
submitted after that completed response; no write was replayed. Before the single
write, exact car/device identity, 49-byte completeness, configuration ID and a
fresh source timestamp were rechecked. The durable marker and returned queue ID
were saved immediately. These are manual upstream operations, not newly added
application mutations or a Fleet operation ID.

The sole write command was:

```text
30,1,19,0,19,302,0,1,1,03E903E8010208000101000000000003130101000303010000000000000000000000000000000000000000000000000000
```

Independent response:

```text
19,0,410,0,1,1,1001,03E903E8010208000101000000000003130101000303010000000000000000000000000000000000000000000000000000
```

Compared with fresh baseline `7170983813`, only zero-based byte **18** changed
**00→01**. **All other 48 bytes are identical**, including byte 7=0, byte 24=0,
configuration ID1001 and message size1000. The user's whole export was not sent.
No reset, clear, profile, parameter, rule or histogram write was submitted.
**Final state is Process DTCs=1 under the source/export mapping; it was not restored
or toggled again. The one-change allowance for this stage has been used.**

### What the actual fault-read response establishes

Both real logger reads returned the exact special NCK `19,0,154,0`, observed as
Karma event **33**, rather than a `413`/`418`/`419` list. The inspected Monitor 9.56
`Is_Special_Nck_Recieved` method recognizes that frame; in
`Process_Recieved_Fault_Codes` it displays "The are no fault codes in the device
buffer." This establishes an actual request/terminal-response path and the
manufacturer program's interpretation in the fault-read context. It is not a
universal empty-ECU guarantee, a repair confirmation or proof of every firmware's
negative-response semantics. The earlier independent reads had reached failed-ACK
states before the isolated logger request; there was no fresh overlapping `301`
request in this response window.

Diagnostic prefix **00000000** at **08:06:50** shows no CAN bit, OBD mask 0,
CAN-error byte 0 and ignition 0/off. Trailing `000002` is uninterpreted. This is
different from the earlier ignition-on CAN-error snapshot; it does not establish
that the original CAN problem was repaired. No new live DTC can be proved from
an empty logger and absent CAN source alone.

At **07:53:29.966 / 07:53:30.048**, existing profile queue **56116206** and full
parameter queue **56116223** both returned state **3 / failed to receive ack**.
Their earlier queued/waiting states must not be repeated as current findings.
The earlier CB1147TP logger queue **56110479** remained state1/transmitted at its
07:54:36 check; it was not duplicated.

The remaining runtime acceptance prerequisite is a compatible **known-present
vehicle fault with active CAN**, or an identified real capture/bench expectation.
Until then, configuration and terminal-response handling are verified for this
scope, while actual DTC code decoding, automatic transitions and ECU-state semantics
remain open. Do not send ERM generic questions about an untried logger read or
unknown DTC checkbox bytes.

This phase used **28 additional targeted attempts**, including the real one-time
write and the freshness-gate retry. Cumulative counts: 02 **49/50**, 03 **8/50**,
04 **24/50**, 05 **18/50**, 06 **16/50**, 07 **12/50**; stage01 remains **20/50**.
No automated test suites, UI changes, server/routing tests or scheduled continuation
were performed.

## Completed live reporting and active-CAN fault control

After the DTC test, a dated project eData query timed out at18 seconds. A different
query using a verified source-ID lower bound succeeded and identified genuinely
advancing CB1147TP 662 and CB9680TE 539 data. This avoided treating a slow date
filter as evidence that no accessible truck had CAN data. All source times below
are **2026-10-27 UTC**; values are unscaled Karma source values.

### CB1147TP 662: complete 30→60-second test

Target: **car 16595 / device 862129080367299 / CB1147TP**, source description
**Engine Fuel Rate (L/h)**. The initial current source series contained25 records
at approximately30-second spacing. Subsequent pre-write samples still advanced
through **08:19:45**, source ID7171038874/value25. Fresh diagnostic
**7171030814**, **08:16:31**, was `19,0,411,0,1,1,1001,0100000101000A`:
CAN bit present, CAN-error 0, ignition 1; extension uninterpreted.

The existing local development services were started through their normal scripts.
Fleet dispatch/writes were initially disabled; all ten local car-operation lists
were inspected and no unfinished operation was found. Dispatch/writes were enabled
only in the temporary Fleet process for the authorized interval workflow. No source
or environment file was changed, and no automatic test suites were run.

| Evidence                           | Exact reference/time                                                                  |
| ---------------------------------- | ------------------------------------------------------------------------------------- |
| Fresh complete baseline operation  | **047ca35d-6fc5-4acb-ac4e-2c6b940d2024**                                              |
| Baseline requested / complete      | **08:19:14.249 / 08:19:59.894**                                                       |
| Baseline queue                     | **56116905**                                                                          |
| Controlled update operation        | **bab36c8a-d2aa-4ff1-a5c0-d90b75cd3e93**                                              |
| Update requested                   | **08:20:53.282**                                                                      |
| Actual write dispatch marker       | **08:21:47.058**                                                                      |
| Operation-exposed queue references | **56116984, 56117001**; retain the list without inventing unexposed queue-role fields |
| Fresh preflight `401`              | **7171044154**, **08:21:09**, complete14 definitions, 662=30                          |
| Independent verification `401`     | **7171046524**, **08:21:56**, complete14 definitions, 662=60                          |
| Fleet completion                   | **08:22:40.648**, COMPLETE, writeUncertain=false, complete coverage                   |

Independent comparison confirmed the **same 14 parameter IDs**, **all 13 unrelated
definitions identical byte-for-byte**, and unchanged first20 bytes of662. Only its
interval field changed:

```text
Before: 0296000000000000000000000000000000000000001E
After:  0296000000000000000000000000000000000000003C
```

The following five distinct records are after both the independent source readback
and the later Fleet COMPLETE timestamp. Each was matched to an actual raw **405**;
none is407/end-of-trip.

| Source message ID | UTC `edt`    | Source662 value | Consecutive delta |
| ----------------- | ------------ | --------------- | ----------------- |
| **7171056491**    | **08:23:00** | **13**          | —                 |
| **7171057524**    | **08:24:00** | **16**          | **60s**           |
| **7171059267**    | **08:25:00** | **1**           | **60s**           |
| **7171060544**    | **08:26:00** | **47**          | **60s**           |
| **7171062377**    | **08:27:00** | **1**           | **60s**           |

A live `karmaEdata` Gateway query returned all five with identical IDs, device,
UTC source times and values. This proves the actual requested cadence and the
existing API-to-Gateway measurement path for this scope, not only a saved setting.
**Final662 setting remains 60 seconds.** No duplicate interval update was submitted.

### CB9680TE 539: delayed measurement proof without another write

Target: **car 16589 / device 862129080332111 / CB9680TE**. The earlier independent
read had verified539=120 on25 October (write operation
`b566ff88-e972-40c9-9e18-0ccbfb797a49`, independent read queue56083079/message
7166321751 at20:47:11 UTC). The new current records are:

| Source message ID | UTC `edt`, 27October | Source539 value | Raw family | Delta                               |
| ----------------- | -------------------- | --------------- | ---------- | ----------------------------------- |
| **7171011498**    | **08:06:32**         | **51**          | **405**    | —                                   |
| **7171012454**    | **08:08:32**         | **53**          | **405**    | **120s**                            |
| **7171012637**    | **08:10:33**         | **54**          | **405**    | **121s**                            |
| 7171015478        | 08:12:10             | 55              | **407**    | 97s; excluded from periodic cadence |

All three periodic records have source identity/values matched between `/edata`
and raw `/events`. This is genuine delayed post-verification measurement evidence
consistent with the earlier120-second setting, with1-second jitter. It is not a
new-truck180→120 experiment and does not establish a continuous series across
the two-day observation gap. **No new command or setting write was sent to CB9680TE.**

### Additional real fault read with active CAN

Only after the interval operation completed, a separate read-only control used
CB1147TP. Global READ **56117049** returned **7171058314**, **08:24:59**:
byte 18=0 under the matched layout. It was left unchanged; the one DTC write remains
only on CB1344XH.

Stored-fault READ **56117097** returned exact **`19,0,154,0`**, message
**7171069664**, **08:28:47**, Karma event33. Periodic405 data continued around it,
including **7171069931**, **08:29:01**. Thus the actual reader also produced a
terminal response on a control with an advancing CAN source; the primary truck's
CAN absence is not a complete explanation of every empty-buffer result. With
the control's DTC flag 0 and no independently known fault, this still does not prove
automatic DTC collection, supported fault-code decoding or vehicle fault absence.

Across the two trucks, **three isolated real logger reads** now returned154,0:
before and after verified DTC enablement on CB1344XH, and on active-CAN CB1147TP.
Monitor's contextual empty-buffer interpretation is observed source evidence;
whether this same frame can also represent unsupported/rejected operations on
these firmwares remains a precise contract question.

### What remains ours versus what needs an external condition

- Existing interval read/change/readback and received measurements now have real
  proof. The interface can use those existing Fleet operations and distinguish
  configuration confirmation from measured cadence; it must still handle provider
  timeouts separately from empty success.
- The DTC global toggle was manually proved. A product checkbox still needs an
  explicit Fleet-owned global-read/one-byte-change/independent-readback operation;
  it is not implemented by this diagnostic campaign. This is our implementation
  work, not a question for ERM to explain a button or a basic toggle command.
- A real known-present fault with active CAN is still required to close actual
  `413`/`418`/`419` decoding/automatic-lifecycle acceptance. No fault was induced or
  cleared. The current empty-buffer observations cannot replace that condition.
- The reproducible byte 7 export discrepancy, current hardware/extension/profile
  compatibility and corrected fault-format documentation remain attributable ERM
  questions. Earlier broad “nothing reads/there is no active truck” claims are
  superseded by these actual successes.

The old `prove-karma-539-live-reporting` heartbeat was checked for deletion after
measurement proof; the app confirmed it already did not exist. No new automation
or scheduled continuation was created, and no message was sent to another chat/person.

This live-control continuation used23 additional stage03 attempts and5 stage05
attempts. Current cumulative counts are stage02 **49/50**, stage03 **31/50**,
stage04 **24/50**, stage05 **23/50**, stage06 **16/50**, stage07 **12/50**;
stage01 retains **20/50**. Across the DTC and interval tests there were exactly
**two intentional setting writes**, one per authorized functionality, and no
write replay. All task-started local runtime processes were stopped after the
completed operations; their temporary feature flags were not written to an
environment file. The chat remains open and completed settings remain as stated.

## Active CAN and enabled DTC on the same truck

The user's subsequent request explicitly authorized configuring **one of CB1147TP
or CB1344XH** and reading faults while online. This newly authorized one DTC-only
change on CB1147TP; the earlier one-change allowance on CB1344XH was not replayed.
The earlier controls had not combined enabled DTC and advancing CAN on the same
truck: CB1344XH had DTC=1 with no CAN at the post-enable check, while CB1147TP had
active CAN with DTC=0. This phase closes that test-condition gap.

**Target:** CB1147TP, car **16595**, device **862129080367299**, Karma label
**StarLink_Scout6**, project **3611**. Fresh identity matched before the write.
Current source `7171137982`, **08:50:03 UTC**, was an actual periodic `405`, with
advancing measurements in the preceding series. Tracker contact was not used as
CAN proof. All times in this section are **2026-10-27 UTC**.

| Step                                   | Queue        | Request UTC      | Identified source evidence                                          |
| -------------------------------------- | ------------ | ---------------- | ------------------------------------------------------------------- |
| Complete global baseline READ `303`    | 56117564     | 08:50:56.873     | `7171142710`, **08:51:02**, complete 49-byte `410`, DTC byte 18=0   |
| One DTC-only write `302`               | **56117580** | **08:52:30.377** | `7171149352`, 08:52:36, `154,1`; ACK alone was not verification     |
| Independent complete global READ `303` | **56117584** | **08:52:41.167** | **7171149727, 08:52:57**, all 49 bytes match intended output, DTC=1 |
| Isolated stored-fault READ `301`/`19`  | **56117619** | **08:54:28.906** | **7171154531, 08:54:32**, exact `19,0,154,0`, Karma event33         |
| Following periodic CAN record          | —            | —                | **7171154700, 08:54:33**, actual `405`, same car/device             |

The fresh baseline was 88.375 seconds old at the write gate. Only global byte
**18 changed 00→01; all other 48 bytes are identical**. Independent source reply:

```text
19,0,410,0,1,1,1001,03E903E8010208000101000000000003130101000303010000000000000000000000000000000000000000000000000000
```

The isolated fault request was exactly:

```text
30,1,19,0,19,301,0,1,1,19
```

Its actual terminal response was:

```text
19,0,154,0
```

Actual `405` reports continued after verified enablement at **08:53:03**, **08:53:33**,
**08:54:03** and **08:54:33**. This establishes active CAN data around the fault
read on the same DTC-enabled device. Diagnostic request **56117563**, submitted
08:50:56.531, was state1/transmitted at08:55:03; no identified new `411` was in the
collected window. No current ignition bit or extension meaning is invented.

**Result:** our direct Karma path can configure Process DTCs, independently verify
the complete result, submit the documented logger read and receive a real terminal
response while CAN data is advancing. Monitor9.56 interprets `154,0` in this branch
as no codes in the device buffer. **No actual `413`/`418`/`419` fault-code list was
received.** This is not proof that all vehicle ECUs are fault-free, that this read
initiates a fresh ECU scan, or that every firmware uses the same NCK semantics.
A known-present compatible vehicle fault or a labelled real capture is still needed
for positive code decoding and added/removed lifecycle acceptance. We did not induce,
clear or repair faults. The absence of a positive list alone does not establish an
integration defect or a device defect.

**Final configuration: CB1147TP DTC=1 remains enabled; its previously verified
662=60 was not rewritten. CB1344XH was not commanded or changed in this phase and
its last verified DTC=1 remains the recorded state.** No profile, parameter, rule,
reset, clear or routing write was submitted. Preservation proof is byte-for-byte for
globals; no new independent non-global before/after comparison is claimed. This
manual upstream proof does not implement a product DTC-setting mutation or UI.

Two initial requests used an incorrect `/messages` path and returned explicit
HTTP404 before any device command was accepted. They were counted, corrected to
the documented `/commands` path and not treated as pending device reads. One
accepted diagnostic read, one baseline read, one write, one independent read and
one isolated logger read were sent; no accepted command was duplicated.

The successful `/edata` `from_id=7171069931` read also included the boundary record
itself. Consumers must deduplicate by source identity and enforce their requested
UTC measurement window; strict exclusion of the bound must not be assumed.

This phase used **23 targeted requests**, including login, both HTTP404 failures,
queue checks and bounded source inspections: stage04 **13** and stage05 **10**.
Authentication was retrospectively entered when the request-counter helper was
initialized; it is included in the cap. Latest cumulative counts: 01 **20/50**,
02 **49/50**, 03 **31/50**, 04 **37/50**, 05 **33/50**, 06 **16/50**, 07 **12/50**.
No scheduled continuation or automated test suite was started. Next DTC acceptance
step is the known-fault control, rather than another blind checkbox/logger cycle.

## Reply-ready questions for Oz: server topics excluded

**Subject: eData integration: CAN availability and remaining diagnostic questions**

Hi Oz,

Thank you for your help. We want our integration to let users select the data and
reporting intervals for each device, and retrieve diagnostic information and
vehicle faults reliably. We have now verified diagnostic, global-settings and
version reads on CB1344XH, compared controlled Monitor exports, and enabled the
Process DTCs field with independent whole-global readback. Real stored-fault reads
before and after that change both returned `19,0,154,0`.

We also completed a real **662 30→60-second** test on active-CAN CB1147TP:
independent whole-set readback preserved all 13 unrelated definitions, and five
new periodic records had four exact60-second intervals. This path also matched
through our Gateway. We are therefore asking about the remaining contracts and
specific observations below, rather than an untried basic configuration procedure.

### Summary

Could you help us close these remaining points?

1. Diagnose CAN disconnections on CB1344XH while the vehicle is moving and ignition
   is on, and identify the correct interface/profile/configuration for it.
2. Resolve one reproducible global export discrepancy and explain the two
   ignition-off processing/reporting options; the DTC byte toggle/readback itself
   is now tested on this device.
3. Provide the supported feature/command matrix and complete DTC reporting contract
   for our tracker/eData firmware, with real labelled examples and code descriptions.
4. Resend the protocol-access account privately and point us to the current applicable
   documentation.

### Technical details

**A. Current vehicle and CAN evidence**

CB1344XH: Karma car **16592**, device **862129080367646**, labelled StarLink_Scout3.
On **27 October 2026 UTC**, we received repeated `417` CAN-disconnection reports
at **07:33:59, 07:35:02 and 07:36:14**, while tracker positions advanced.
Diagnostic message **7170893865**, **07:34:14**, was:

```text
19,0,411,0,1,1,1001,00000101010C80
```

Its documented prefix indicates no CAN communication bit, CAN error 1 and ignition
1/on. What diagnostic/recovery steps should we follow, and how can we distinguish
vehicle-interface/wiring issues from an incorrect baud/profile/module setup?

Version message **7170901092**, **07:36:29**, was:

```text
19,0,412,0,1,1,1001,0638010291066DFF49
```

Please identify the exact module, firmware, hardware-type bits and extension fields.
Our offline export selects profile **343 / 0157**; its installed profile read has
not yet returned, so we have not assumed that it is currently installed.

**B. Global settings and controlled exports**

We now have paired INI/TXT exports showing exactly one changed byte per checkbox:

- Process FMS DTCs: global-data offset **18**, `00` to `01`.
- Send parameters while ignition is off **and CAN alive**: offset **24**, `00` to `01`.

Offsets count from the configuration-ID high byte, excluding outer framing.
We therefore no longer need a generic example showing how to toggle these fields.
However, in the same export the INI says `PROCESS CAN IGNITION OFF=0` and ignition-off
debounce is 2, while generated `302` byte **7 is 02**. This also matches the
parser/serializer discrepancy we found in Monitor 9.56. Which field/value and
Monitor version are correct for this firmware? Please also resolve the conflicting
`302`/`410` labels in the supplied PDF.

A real 49-byte `410` reply was received at **07:35:00**, message **7170895809**.
Under the matched layout, bytes 7, 18 and 24 are all `00`. The export differs from
this live configuration in several unrelated fields, so we have not applied it.

We subsequently changed **only byte 18** using a fresh full-global baseline
(`7170983813`, 08:02:46 UTC). Write queue **56116679** was submitted at
**08:03:52.548**, followed by independent READ queue **56116692**. Reply
**7170990372**, **08:04:54**, matched the intended 49-byte result exactly:
byte 18=1 and all other 48 bytes unchanged. DTC remains enabled; byte 7/byte 24 were
preserved at 0. We are not asking for another basic checkbox-toggle example.

How do the separate ignition-off CAN-processing and CAN-alive reporting options
interact? Are separate StarLink settings such as 2069/2070 required? Does reporting
use fresh values only, and what happens when CAN goes to sleep?

**C. Supported functions and fault reporting**

Please provide the firmware/profile requirements and remote command/readback support
for telemetry definitions/intervals, profiles, rules, histograms/counters and diagnostic
features, identifying anything that requires a local connection.

For DTCs specifically, please clarify:

- `418`: Monitor reads five character bytes, but the printed P1482 example does not
  decode consistently. Please provide a corrected raw example and expected code/status.
- `419`: Monitor reads a four-byte big-endian SPN plus FMI/status, while the PDF table
  says one-byte SPN. Please confirm the field/bit rules and supply a real labelled report.
- `301` payload `19`: expected reply families, fragments/terminal markers, empty-logger
  response, and whether this reads stored faults or triggers a fresh ECU scan.
- Automatic reporting: initial snapshot versus transitions, reconnect/ignition behaviour,
  exact Karma endpoint/event codes, and whether removal means logger removal or ECU clearance.
- Fault-code descriptions and the separate tracker/internal-error and command-result catalogue.

The diagnostic, global and version reads worked. Profile READ queue **56116206**
and full-parameter READ queue **56116223** subsequently reached
`failed to receive ack`. Please explain the expected acknowledgement/timeout and
request sequencing. We have not duplicated those requests.

Isolated logger READ **56116505** returned `19,0,154,0` at **07:54:20 UTC**,
before enablement. Post-enable logger READ **56116699** returned the same frame
at **08:05:20**. Monitor 9.56 interprets it as no codes in the device buffer in
this context. Can this frame also indicate an unsupported/rejected operation on
our firmware, and how should those cases be distinguished? Diagnostic **7170996746**
at **08:06:50** showed ignition off and no CAN bit, so we do not interpret this
as proof that the vehicle has no ECU faults.

As a control, we read CB1147TP's fault logger while periodic CAN measurements
were advancing. At that earlier control its DTC flag was0 and was left unchanged. READ **56117097**
returned the same `19,0,154,0` at **08:28:47**, followed by another periodic 405
at 08:29:01. We understand that an empty logger does not supply a known-present
fault for positive code/lifecycle validation.

We then enabled DTC on this same active-CAN CB1147TP: write **56117580** at
**08:52:30.377**, independent full-global read **56117584** / **7171149727** at
**08:52:57**, only byte18 changed and all48 other bytes identical. With periodic
405 reports continuing, isolated logger read **56117619** returned the same
`19,0,154,0` as **7171154531** at **08:54:32**, followed by405 at08:54:33. DTC
remains enabled. This rules out our earlier disabled-DTC/no-CAN test-condition gap;
it still does not establish that the vehicle has no ECU faults or provide a positive
fault-code sample.

Please suggest a compatible known-fault vehicle/bench condition, or provide a real
labelled capture, so we can verify the complete DTC path without generating or clearing faults.

**D. Protocol access**

Please resend the access email referenced as **7/10/2026** privately and identify
the current command, response, acknowledgement and diagnostic pages applicable to
the version above. We can reach the public login page but lack the protocol account.

Thank you.
