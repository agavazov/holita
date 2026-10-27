# eData diagnostics and fault reporting

Source-contract review: **2026-10-27**, ERM-TEST-01. This reference complements
[parameter reporting](parameter-reporting.md) and the
[ERM correspondence analysis](../erm-support-diagnostics-protocol-test-server/analysis.md).
It describes the supplied **eData Simple Protocol 4.04**; authenticated access to
the current StarLink portal remains unavailable. No command below was sent to a
device during this review. Source confirmation is not installed-firmware proof.

## Reading stored fault codes

Section **2.3.16**, physical [PDF page 12](content.md#pdf-page-12), explicitly
documents reading the faults stored in the **CAN Engine fault logger**:

```text
30,1,19,0,19,301,0,1,1,19
```

The printed example has whitespace before the final `19`; the string above removes
that whitespace only. `301` selects a CAN Engine operation, while payload `19`
selects the stored-fault read. This is a request, distinct from automatic fault
transitions after fault processing is enabled. It reads the module's logger, not
a guaranteed fresh scan of every vehicle ECU.

The source defines OBD/FMS/FMI fault families separately. The exact reply family,
numbering/completeness, empty-logger representation and correlation for this request
still need firmware-specific evidence. Do not promise that every installation
returns all of `413`, `418` and `419` or assume a Karma event ID from the payload number.

Adjacent operations `1A` and `1B` are **not read alternatives**: the source describes
`1A` as clearing the module logger and `1B` as clearing vehicle ECU faults. They are
outside the verification campaign. Do not use reset, clear or CAN-transmit operations
to generate diagnostic evidence.

The existing [read-command table](parameter-reporting.md#reading-the-current-state)
also records these exact documented requests:

- `306` for the `411` diagnostic snapshot.
- `308` for `412` software/hardware version information.
- `303` for the full `410` global-setting report.
- `301` with `1F` for the `416` vehicle profile.
- `301` with `0702BC` for complete `401` parameter definitions.

The table's wrappers follow the existing Karma integration examples; several PDF
examples omit fields or contain editorial mistakes. That does not establish a new
StarLink wire-framing contract. The document alone also does not prove permission,
delivery, timeout or model compatibility for any of these requests.

## Report families and interpretation

| Report | Source scope                                            | What can be read from the specification                                                                            | What remains unverified                                                                                    |
| ------ | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| `411`  | Diagnostic snapshot, section 3.11, physical page 24     | First four bytes: communication mask (bit 0 CAN, bit 1 J1708, bit 2 OBD), OBD mask, CAN-error flag, ignition 0/1/2 | Installed firmware extensions; no interpretation of trailing bytes from this table alone                   |
| `412`  | Version information, section 3.12, physical pages 24-25 | Five-byte example: software major/minor, hardware major/minor, hardware type                                       | Extended layouts, complete tracker/accessory identity and minimum supported firmware                       |
| `413`  | OBD faults, section 3.13, physical page 25              | Payload type `19`, repeated two-byte code and one-byte added/removed status                                        | Actual live response, request correlation, lifecycle/empty-buffer semantics and code-description catalogue |
| `418`  | FMS faults, section 3.18, physical page 27              | Payload type `20`, table says five ASCII code bytes plus status                                                    | Printed encoding does not reproduce its first code label; canonical wire/API representation required       |
| `419`  | FMI faults, section 3.19, physical pages 27-28          | Payload type `21`, SPN, FMI and status                                                                             | Table says one-byte SPN despite 19-bit range; printed sample fits four-byte SPNs                           |

An eData payload type is not a Karma API `event_type`. Obtain the actual API mapping
by a known source report or vendor contract. Logger status `01`/`02` means added/
deleted in the reported logger; deletion does not prove a repair or ECU clearance.
An empty buffer or missing telemetry does not prove that the vehicle has no faults.

The `411` CAN-error flag is not a complete tracker/internal-error catalogue.
Vehicle DTC reports, tracker command-result codes and other internal device errors
must remain distinct. Current StarLink error/result definitions were not obtained
behind the portal login gate and still require applicable vendor documentation.

## Internally consistent OBD example

The source's `413` example is:

```text
19,0,413,0,1,1,1001,19111101622202B33301
```

After payload type `19`, grouping the data into two code bytes plus one status byte
reproduces every printed code using a two-bit P/C/B/U prefix, two-bit
first digit and remaining three hexadecimal digits:

| Raw code | Decoded code matching the source | Status byte   |
| -------- | -------------------------------- | ------------- |
| `1111`   | `P1111`                          | `01`, added   |
| `6222`   | `C2222`                          | `02`, removed |
| `B333`   | `B3333`                          | `01`, added   |

This is an interpretation checked against all three printed codes. It confirms
the consistency of this **documented example**. It does not prove
that the selected truck is in OBD mode, emits these records or supports every ECU.
The Monitor guide's DTC view is explicitly described in an
[OBD-mode context](../simple-edata-monitor-configuration-v1.0/content.md#pdf-page-25).
Do not substitute this encoding for the different FMS `418` table.

## Process DTCs and unresolved source conflicts

The engineer states that enabling **Process DTCs** starts fault-code transmission.
Section 2.4's global `302` command lists **Process FMS DTCs** and describes querying
faults from FMS. It also lists accept/decline debounce counts and an option to report
parameters when a fault occurs. This is more than a generic periodic interval setting.

The original PDF's physical pages **14** (`302`) and **23** (`410`) were visually
compared. Both contain the conflict: after **Report Parameters When Rule Occurs**,
the write table labels the next byte **Process FMS DTCs**, while the read table
labels that position **Keep Alive Message Time Interval**. The other mismatch,
CANBUS #2 baud versus ignition-off processing, also remains in the source.
Consequently no compatible flag offset/value or `302` write payload is established
by this review. Preserve complete raw globals until ERM or a canonical matching
Monitor export resolves the layout for the installed firmware.

The [`418`/`419` analysis](../erm-support-diagnostics-protocol-test-server/analysis.md#images-2-and-3-fms-fault-report-418)
retains the printed samples and contradictory labels. In particular, decimal
character pairs in `418` yield `P1488`, not the printed `P1482`; ordinary hex ASCII
does not decode as either printed code. The `419` sample fits SPN 42,406/FMI 5/added
and SPN 45,347/FMI 4/removed using four-byte SPNs, but that is not a validated
firmware contract.

The [2018 Karma appendix](../karma-guide-appendix-v1.4.2/content.md#pdf-page-9)
mentions StarLink parameters 2069/2070 for its DTC application. Their relationship
to this eData flag and current installation remains unverified. Do not apply those
system-parameter values as eData IDs or assume an additional write is necessary.

## Scope for the next device stage

Known read requests can support ERM-TEST-02's bounded, explicitly identified device
reads, followed by independent observation. Do not start Process DTCs writes merely
because the request strings for reads are documented. ERM-TEST-05 must cover the
applicable **OBD `413` and/or FMS `418`** path; ERM-TEST-06 covers FMI `419` only
on a compatible installation. Missing faults, missing compatibility and a decoding
contradiction are separate outcomes.

Current evidence and unresolved vendor questions remain in the
[verification register](../erm-support-diagnostics-protocol-test-server/README.md#verification-register)
and the [existing backlog](../../../todo/karma-api-v2.md#questions-requiring-erm-clarification).

## Subsequent Monitor 9.56 implementation evidence

The [combined verification campaign](../erm-support-diagnostics-protocol-test-server/live-verification-2026-10-27.md)
inspected the supplied manufacturer's executable as PE/.NET metadata and CIL,
without executing it. Its `Process_Recieved_Fault_Codes` decoder reads two code
bytes plus status for `413`, five byte-to-character conversions plus status for
`418`, and **four big-endian SPN bytes**, FMI and status for `419`. This is stronger
package-specific evidence than interpreting a contradictory printed sample, but
no real installed-firmware `413`/`418`/`419` was established by those source checks.
The printed `418` example and the `419` table still require vendor correction;
reserved-bit/19-bit rules and current-state semantics remain unresolved.

For globals, both `Global_Params_Struct.Update_Params_Values` and
`Get_Params_As_Binary_List` use byte **18** for `Process_FMS_DTCs`, counting from
the configuration-ID high byte of the global data, excluding outer framing.
However, at byte **7** their fields differ: the parser reads ignition-off CAN
processing, while the serializer emits ignition-off debounce. These precise
package observations do not authorize assuming a compatible full global write.
Keep the installed raw `410`, version/profile and independent readback as separate
requirements. No `302` write was submitted during this campaign.

The [later user-supplied paired exports](../erm-support-diagnostics-protocol-test-server/live-verification-2026-10-27.md#morning-recheck-paired-monitor-exports-and-cb1344xh)
independently confirm DTC byte 18 `00`/`01` and
`SEND PARAMS WHILE IGN OFF AND CAN ALIVE` byte 24 `00`/`01`, in 49-byte global
payloads. All other bytes/commands match within each pair. The same exports
reproduce byte 7=`02` despite INI ignition-off CAN processing=`0` and debounce=`2`.
These supplied source artifacts establish command generation, not an installed
checkbox change. Their other settings differ from the newly read CB1344XH baseline.

The morning recheck also received actual `417` reports and a `411` prefix
`00000101` from CB1344XH while ignition was on: no CAN communication bit and
CAN error 1. Per section 3.17, `417` reports absence of CAN messages for 500 ms
with ignition on. Real `410` and `412` reads succeeded on that device; no actual
`413`/`418`/`419` or root cause of the CAN interruption was established.

## Actual Process DTCs configuration and fault reads

The [subsequent real test](../erm-support-diagnostics-protocol-test-server/live-verification-2026-10-27.md#actual-dtc-read-and-controlled-configuration-test)
performed one `302` change on **CB1344XH / car 16592 / device 862129080367646**.
Fresh complete globals `7170983813` at **2026-10-27 08:02:46 UTC** supplied all
49 bytes. Write queue **56116679** changed only byte 18 `00→01`; independent
`303` READ **56116692** returned `7170990372` at **08:04:54 UTC** with an exact
whole-payload match. All other 48 global bytes were identical, including byte 7
and byte 24. **DTC remains 1**. No profile/parameter/rule snapshot comparison is
claimed; those settings were not written by this test. This is a manual upstream
configuration proof, not a new public or internal holita global-setting API.

Isolated `301`/`19` reads before/after enablement, queues **56116505/56116699**,
returned exact `19,0,154,0` messages **7170957590/7170992553** at
**07:54:20/08:05:20 UTC**, observed as Karma event33. Monitor9.56 recognizes this
special NCK and, in its fault-loader branch, displays no fault codes in the device
buffer. This is actual terminal-response evidence plus the manufacturer's
contextual interpretation, not a known real DTC list or a universal empty-ECU
guarantee. At08:06:50, a new `411` showed ignition 0/no CAN; automatic fault
transmission and lifecycle still require an active compatible source and known
fault. The original CAN-disconnection cause is not established as repaired.

### Enabled DTC with advancing CAN on CB1147TP

The [subsequent same-device control](../erm-support-diagnostics-protocol-test-server/live-verification-2026-10-27.md#active-can-and-enabled-dtc-on-the-same-truck)
closed the earlier test-condition gap. CB1147TP/car16595/device862129080367299
had current periodic405 reports. Fresh complete410 baseline7171142710 at
2026-10-27 08:51:02 UTC supplied the DTC-only302 write56117580 at08:52:30.377.
Independent303 read56117584 returned7171149727 at08:52:57: DTC byte18=1,
all48 unrelated global bytes identical. Isolated301/19 read56117619 returned
7171154531 at08:54:32, exact154,0/event33, followed by405 at08:54:33. No actual
413/418/419 list was received. Thus configuration and terminal-response transport
work with enabled DTC and active CAN on the same device; a known-present fault
is still required for positive code/lifecycle proof. Final CB1147TP DTC=1 was left
enabled and its existing662=60 was not rewritten. This is direct upstream evidence,
not a newly implemented product global-setting/fault API.
