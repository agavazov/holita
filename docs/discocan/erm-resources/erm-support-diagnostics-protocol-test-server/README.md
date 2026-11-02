# ERM support: diagnostics, protocol access and Test Server

Updated **2026-10-29**, Europe/Sofia. **Positive fault reading is now proved for
identified source events through Karma and the existing Gateway:** the [current live campaign](live-verification-2026-10-29.md)
independently retrieved ERM's `419` event **7177124308** with SPN 4339 / FMI 7 and
SPN 1247 / FMI 11, and a current-day `419` event **7179721665** with SPN 23806 / FMI 15.
All three records carry status **01, added**. This proves actual raw fault-data
reception and a consistent four-byte big-endian SPN decode for these reports.
The Gateway `karmaEvents` query preserved both identified source events exactly.
An on-demand response, complete current ECU inventory, fault descriptions and
added→removed lifecycle require separate evidence.

The **29 October reply explicitly defines `154,0` as command not acknowledged**.
Earlier negative replies are retained as historical observations, but they must
not be reported as a successful empty fault read. A delivery state, positive ACK,
Monitor checkbox and actual fault record establish different things.

[ERM resources](../README.md) ·
[New reply: full technical analysis and all four images](reply-2026-10-29.md) ·
[All 29 supplied commands and three-command procedure](command-reference-2026-10-29.md) ·
[Current live evidence](live-verification-2026-10-29.md) ·
[Open work](../../../todo/karma-api-v2.md#erm-support-verification).

## Evidence and source material

| Material | Reference and scope |
| --- | --- |
| Original email questions and first reply | [27 October correspondence](correspondence.md); original safe [ODT](source/erm-support-reply.odt), preserved unchanged. |
| First four images and source inconsistencies | [27 October analysis](analysis.md), retained as a dated source assessment. |
| First device campaign and readback/cadence proof | [27 October live campaign](live-verification-2026-10-27.md). Its absence of positive fault reports describes that earlier observation window only. |
| New reply and four new images | [29 October technical summary](reply-2026-10-29.md), including every visible image field, exact fault/ACK excerpts and question-by-question coverage. |
| New Monitor command attachment | [Command reference](command-reference-2026-10-29.md) and [unchanged TXT](source/2026-10-29-fms-rental-sofia-60-second-commands.txt). |
| Current independent API and device tests | [29 October live campaign](live-verification-2026-10-29.md). |
| Provenance | [Metadata](metadata.json): source hashes, image hashes/dimensions and timestamp qualifications. |

The new ODT contains portal credentials and remains in the user-supplied private
source location. Documentation contains its hash and sanitized technical summary,
not the credential-bearing ODT or its access paragraphs. All eight original
images are unchanged; new images have `2026-10-29-` filenames. Source evidence is
kept separate from vendor interpretation and our independent observations.

The first reply's ODT lacks email headers. A matching Outlook reply was separately
found with received time **2026-10-25 08:39:01 UTC**; its ODT export timestamp is
**2026-10-26 21:32:00 UTC**. The new ODT export timestamp is
**2026-10-29 14:18:00 UTC**, also not an email send timestamp. Its device-event
excerpts do not themselves specify timezone; independently retrieved API times
are recorded as UTC in the live evidence.

## Verification register

Status date: **2026-10-29**. Rows distinguish the observation actually established
from the remaining contract or runtime gap. The [current live evidence](live-verification-2026-10-29.md)
contains exact test targets, request/queue references, source IDs, timestamps and
final outcomes; the register does not substitute for those records.

| ID | Subject | Established evidence | Remaining limit |
| --- | --- | --- | --- |
| ERM-DTC-01 | Process DTCs activation | On 27 October, independently verified complete 49-byte `410` on CB1344XH and CB1147TP: byte18 `00→01`, other 48 bytes identical. New image/ERM interpretation confirms the supplied readback has DTC enabled. | Checkbox/readback alone does not prove compatible ECU coverage or a successful explicit logger read. |
| ERM-DTC-02 | FMS fault report `418` | Monitor 9.56 reads five character bytes plus status. Source example remains inconsistent. | No corrected labelled live `418` contract is supplied by the new reply; retain the exact printed discrepancy. |
| ERM-DTC-03 | FMI fault report `419` | Independently reacquired event 7177124308 gives SPN 4339 / FMI 7 and SPN 1247 / FMI 11; event 7179721665 adds SPN 23806 / FMI 15. All status 01. Four-byte big-endian SPN is consistent with real reports and Monitor. | Reserved/upper-bit rules, ECU/source identity, descriptions, complete active inventory and removed-state lifecycle remain unresolved. |
| ERM-DTC-04 | Faults in Karma/API | **Positive, identified raw fault events independently retrieved**; report 419 is carried in Karma event 33 `extra`. | Do not generalize all vehicle/model/ECU coverage or equate historical event reception with a fresh requested scan. |
| ERM-DTC-05 | Explicit stored-fault read `301`/`19`; OBD `413` | Read command is documented and supplied again. Earlier four isolated reads on two trucks returned 154,0; ERM now explicitly defines that as NACK. Current fleet-wide reads/outcomes belong to the live campaign. | Negative ACK is not an empty logger. A419 report near a request needs actual association before claiming on-demand success. `413` remains a separate format/path. |
| ERM-COMPAT-01 | Model/firmware/profile | Earlier profile 343 and actual 411/412/global replies; new export selects343 and screenshot names FMS Parameters(250k). | No exhaustive supported hardware/firmware/vehicle/ECU matrix; extended 412 and profile applicability remain version-specific. |
| ERM-PORTAL-01 | Protocol access | Credentials now supplied, superseding the earlier unavailable-account condition. | Authenticated extraction and completeness are documented in the [current portal reference](../starlink-online-protocol/README.md). Access is separate from Test Server access. |
| ERM-CONFIG-01 | Interval changes versus bulk replacement | Earlier CB1147TP 662 single-definition `02` 30→60 was independently verified across 14 definitions and five new 405s/four 60s deltas. New export uses bulk `01`, all 14 at60, then profile 343. | ERM's three-command requirement must be scoped to full export versus proven single-definition update. Later mixed screenshot does not erase dated readback/cadence proof. |
| ERM-ACK-01 | Positive/negative eData ACK | Supplied table:154 response 0=not acknowledged/error,1=acknowledged. Identified vendor ACK 7179129747=`19,0,154,1`. | ACK is not full readback or fault list; no universal queue-to-event correlation is supplied. Vendor POST queue example differs from observed GET. |
| ERM-SERVER-01 | Simultaneous forwarding | First reply describes a fork to our server and ERM Test Server. | New reply supplies no endpoint, fork procedure, transport or ACK/command ownership. Not live-verified. |
| ERM-SERVER-02 | Capture/replay/simulation | Correspondence supplies examples; the authenticated portal now supplies a downloadable Test Server and tool reference. | Actual recording/replay/simulation and packet capture remain unverified. |
| ERM-SERVER-03 | Network configuration and connection proof | Portal G11 supplies local TCP/UDP and port-forwarding guidance; see the [reading guide](../starlink-online-protocol/authenticated-reading-guide.md). | No actual truck routing, installation-specific APN, preservation/restoration or matched two-destination reception was tested. |

## Changes to the earlier conclusions

- **Positive fault data:** the old campaign's “no real 419 observed” statements
  remain accurate for 27 October. They are superseded as a current capability
  assessment by the independently retrieved28/29 October reports.
- **Negative acknowledgement:** the contextual Monitor empty-buffer display is
  an implementation observation; the new explicit protocol definition is NACK.
  Historical 154,0 results cannot prove no vehicle faults or successful logger reads.
- **Portal access:** an earlier missing access email is no longer the current
  blocker because the new private reply supplies credentials. Raw credentials
  remain outside this reference.
- **Interval procedure:** preserve the successful dated `02` test. The new bulk
  export is a distinct `01` replacement, includes global changes at bytes 7/11/12/13
  and selects profile 343. It must not be applied as an assumed DTC-only edit.
- **Source questions:** ERM explicitly still awaits another developer's answer
  on fault format, lifecycle and Monitor export discrepancy. The new419 supports
  four-byte SPNs but does not silently repair the printed 418/419 specifications.

## Recording subsequent confirmations

Use **verified for the stated scope**, **requires further tests**, **requires ERM
clarification**, or **not tested** with the actual evidence. A known queue ID,
`transmitted`, ACK, configuration readback, measured cadence, raw fault report and
fault lifecycle are separate results. For a fault retain the exact car/device,
message ID, UTC source time, raw payload, SPN/FMI/status and request association
if one is actually established. Distinguish automatic, requested and historically
replayed events when the contract permits it; otherwise record the uncertainty.

Keep the original source assets unchanged. Mark changed conclusions explicitly,
link current evidence and keep pending actions in the [existing backlog](../../../todo/karma-api-v2.md#erm-support-verification).
Do not store credentials or unsanitized private transcripts in this reference.
