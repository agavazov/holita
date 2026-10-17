# Restore eData reporting for CB6721TE

Open recovery task recorded on **2026-10-17**. Restore the vehicle's previous
working eData reporting configuration remotely if possible; arrange on-site
diagnosis and restoration if remote recovery cannot be completed and verified.
This task records the incident evidence, not a confirmed root cause or a recovery
command set.

## Affected vehicle

| Field                               | Value             |
| ----------------------------------- | ----------------- |
| Karma `car_id`                      | `16593`           |
| `device_id`                         | `862129080268844` |
| Registration                        | `CB6721TE`        |
| API `car_type`                      | `StarLink_Scout4` |
| Installed eData hardware / firmware | Not yet verified  |

The API identifiers were checked against the same vehicle record. The API model
label does not establish the attached CAN module's exact hardware or firmware.

## Changes reported by the user

The user used the public Karma API help interface's **Send Command** operation,
`POST /commands`, with `car_id: ["16593"]`, sending command strings individually
without the export's comments or headings. There was no contact with the driver
to perform a controlled physical test. Exact submission times for the initial
commands are unavailable.

The following strings are preserved as **incident evidence only; do not replay
them as recovery instructions**. Submission does not prove successful application
by the device.

Global settings:

```text
30,1,19,0,19,302,0,1,1,03E902BC010208020101000101010003130100000303010000000000000000000000000000000000000000000000000000
```

Parameter settings:

```text
30,1,19,0,19,301,0,1,1,0100010000000000000001000100000000000000000000
```

Rules:

```text
30,1,19,0,19,301,0,1,1,0300010000000000010807021500011009C400020000000000010807021500011009C4
```

Vehicle type:

```text
30,1,19,0,19,301,0,1,1,1E01AE
```

The user subsequently supplied this last command and its API response:

```text
30,1,19,0,19,301,0,1,1,0300020000000000010807021500011009C4
```

```json
[55889794]
```

The command's exact submission time is unknown. The user estimated that the
changes had been made roughly 15 minutes before the investigation. Authentication
tokens and credentials are intentionally excluded from this record.

## Evidence relevant to recovery

API reads on 2026-10-17 around **16:49-16:51 Europe/Sofia** established the following
snapshot. Times below use the API's `edt_tz` values, consistent with Sofia's UTC+03
offset on that date; they are record times, not command submission times.

| Time, Europe/Sofia | Observation                                                                                                                                                                      |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 16:26:56           | Last observed multi-parameter eData report: RPM `1112`, wheel-based speed `40` with source label `kph`, and the existing temperature/fuel/hour parameters. Message `7139091144`. |
| 16:26:59           | Last observed eData report: parameter `152`, high-resolution total vehicle distance. Message `7139091247`.                                                                       |
| 16:27:19-16:35:11  | Seven events contain `19,0,154,1`. The meaning of code `154` and result `1` is unverified; these are not established success acknowledgments.                                    |
| 16:33:35           | Last observed subsequent event with nonzero `spd`: `7.2`. Message `7139101915`.                                                                                                  |
| 16:43:26           | Latest available GPS/event record at inspection, with `spd: 0`. Message `7139116572`.                                                                                            |

There were **51 events after the last eData report**, including **40 with nonzero
`spd`**. Recent eData batches before the interruption were approximately three
minutes apart. A follow-up eData query found no report newer than 16:26:59.
Thus, eData reporting stopped while motion records were still arriving; the
tracker did not stop all reporting at the same time. Parking alone does not
explain the earlier eData cutoff. The later GPS silence may have a separate cause,
such as normal parking/sleep behavior, which has not been verified.

`GET /queue/55889794` returned:

```json
{
  "55889794": {
    "state_id": 1,
    "state_desc": "transmitted"
  }
}
```

This establishes the API queue status only. It supplies neither a submission
timestamp nor proof that the eData module accepted and applied the rule. The
initial investigation used server-side reads only. A subsequent diagnostic
readback established the device state below; no configuration writes were made
before the separately authorized RPM interval test described below. The user has
no saved previous working export.

## Device state before the RPM interval test

On 2026-10-17 at **17:00-17:03 Europe/Sofia**, the module answered documented
version, global-settings, parameter-definition and rule-definition read requests.
This confirms that the remote path reaches the eData module, beyond merely
accepting API commands or receiving GPS positions.

| Read operation                              | Queue ID   | Response message ID | Result                                                                                                                          |
| ------------------------------------------- | ---------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `308`: version information                  | `55889995` | `7139142963`        | Type `412`; raw version/hardware payload `06380102910667FF49`. Exact interpretation of the extended payload remains unverified. |
| `303`: global settings                      | `55889996` | `7139146173`        | Type `410`; current global settings returned.                                                                                   |
| `301` / `0703E8`: all parameter definitions | `55889999` | `7139146342`        | Type `401`; one definition, ID `1`, with all remaining definition bytes zero, including its reporting interval.                 |
| `301` / `0803E8`: all rules                 | `55890001` | `7139146528`        | Type `402`; only rule ID `2`, matching the last submitted rule definition.                                                      |

The complete current configuration responses are preserved below. They are a
**post-incident snapshot, not a known-good restore point or outbound commands**:

```text
19,0,410,0,1,1,1001,03E902BC010208020101000000000003130100000303010000000000000000000000000000000000000000000000000000
19,0,401,0,1,1,1001,0700010000000000000000000000000000000000000000
19,0,402,0,1,1,1001,0800020000000000010807021500011009C4
```

The current parameter and rule sets confirm that the former reporting
configuration is no longer present. The current global-setting bytes are not
identical to the submitted global command, and parameter multiplier/divisor
bytes are now zero; device normalization or vehicle-profile effects have not
been established. Do not infer byte-for-byte acceptance of every earlier write.

The available `GET /events` history for this vehicle and event type `33` was
searched across **5571 records**, from **2026-09-30 09:27:00 UTC** through
**2026-10-17 14:02:47 UTC**. A further query below the oldest message ID
`7079213516` returned no older records. No pre-incident configuration readback of
types `401`, `402`, `403`, `410`, `411`, `412` or `416` was found; the configuration
responses in that history are the new diagnostic reads above. This bounds the
available API evidence, not any separate provider/installer archive or outbound
command audit log.

Historical type `405`/`407` records preserve measurements and parameter IDs,
not the complete CAN decoding, reporting and vehicle-profile definitions needed
for a verified restore. A working configuration therefore could not be recovered
from this available history. At the follow-up, GPS/events had advanced to
**17:04:11 Sofia**, while eData still had no records after **16:26:59**.

## RPM interval enabled; live measurement verification pending

The user subsequently authorized a minimal attempt to restore RPM reporting
without changing global settings or waiting for the previous export. The
documented `301` / payload type `02` updates an individual parameter without
deleting the parameter list. A fresh device readback confirmed parameter ID `1`
and its zero interval before the change.

At **17:13:25 Europe/Sofia on 2026-10-17**, queue **`55890085`** submitted this
single-parameter update. Only its reporting interval changed from `0` to **30
seconds**; all other parameter-definition bytes were preserved from the readback.
No global-setting, vehicle-type, rule, reset or firmware writes were sent.

```text
30,1,19,0,19,301,0,1,1,020001000000000000000000000000000000000000001E
```

The device's subsequent type `401` response, message **`7139164580`** at
**17:13:35 Sofia**, confirms the interval was stored:

```text
19,0,401,0,1,1,1001,070001000000000000000000000000000000000000001E
```

Global settings were read before and after the update; their complete 49-byte
payloads matched exactly. This verifies the stored interval and unchanged global
settings, not valid live RPM measurement or complete configuration recovery.

The diagnostic response immediately before the test was
`19,0,411,0,1,1,1001,0000010000000B`. Under the documented four-byte diagnostic
prefix, it reports communication mask `0`, CAN error flag `1` and ignition state
`0` (off); the trailing extension is not decoded. The module responds remotely,
but active CAN traffic is not established. The last diagnostic readback at
**17:14:55 Sofia**, message `7139166464`, was
`19,0,411,0,1,1,1001,00000000000001`: the documented prefix now has CAN error flag
`0`, with communication and ignition still `0`. The reason for the flag change
is not established. Four post-update checks through **17:14:50 Sofia** found no
new RPM reports. The Monitor guide says transmission stops with ignition off,
so absence of new values while parked does not settle whether this interval-only
change is sufficient for the installed vehicle profile.

The **30-second interval remains configured**. A rollback to the captured
pre-test interval can use the following non-deleting update if required; it is
recorded for recovery, **not sent**:

```text
30,1,19,0,19,301,0,1,1,0200010000000000000000000000000000000000000000
```

The old eight other parameter definitions and earlier vehicle/global profile
remain unrecovered. Do not claim RPM restoration until fresh engine-running
reports establish plausible RPM values and the expected reporting cadence.

## Voltage test and retained recovery state

On **2026-10-17**, the user authorized a voltage test. The Monitor 9.56 catalog's
parameter `781` (`030D`, Battery Voltage (Starlink)) was added individually with a
30-second interval at **18:07:38 Sofia**, queue `55890408`:

```text
30,1,19,0,19,301,0,1,1,02030D000000000000000100010000000000000000001E
```

Readback confirmed ID `781` and its interval, with multiplier/divisor normalized
to zero. No ID `781` measurements appeared during checks through **18:10:12**;
the Monitor's `324` current-values request also produced no verified measurement
response. Definition storage alone does not establish support or voltage reporting.

Direct `/location` and `/events` reads selecting `fields[]=vin` and `fields[]=vbat`
returned changing tracker voltages, including records from **18:05:18**, before
the test parameter was added. The diagnostic message at **18:10:19**, ID
`7139248511`, reported ignition off and included `vin: 25.369`, `vbat: 4.159`.
See the [upstream voltage field reference](../discocan/erm-resources/karma-api-v2/data-models.md#additional-upstream-voltage-fields).
This establishes useful telemetry and remote responsiveness while ignition was
off; it does not verify CAN/RPM recovery or continuous availability during sleep.

Because the added parameter was unnecessary for these tracker fields, it was
removed at **18:12:43**, queue `55890461`, using only the specific-ID deletion:

```text
30,1,19,0,19,301,0,1,1,10030D
```

The **18:12:50** readback, message `7139251816`, again contains only the original
RPM definition with its 30-second interval. Its bytes and the full global-settings
payload match the snapshots taken before the voltage test. No global/profile/rule,
reset or firmware writes were made during this test. The subsequent **18:13:04**
message `7139252311` still reports `vin: 25.361` and `vbat: 4.159`. Parameter `781`
is no longer configured; the pending recovery work below is unchanged.

## Configuration concerns to resolve

According to the [eData Simple 4.04 reference](../discocan/erm-resources/edata-simple-protocol-v4.04/README.md):

- Payload type `01` deletes existing parameter definitions before replacing them;
  `03` does the same for rules. Both initial and last rule commands use `03`.
- The submitted parameter payload contains one definition for ID `0001`, with
  Header ID `0`, Bit Count `0`, and reporting interval `0`. The
  [Monitor guide](../discocan/erm-resources/simple-edata-monitor-configuration-v1.0/README.md)
  describes zero as disabling a parameter's reporting. Confirm the applicable
  firmware's handling before concluding that this exact payload was accepted.
- The user also changed global settings and selected vehicle type `1E01AE`.
  Compatibility with the installed hardware, firmware and vehicle profile is
  unverified. There is no known-good configuration for comparison yet.

Readback confirmed the reduced parameter/rule sets and the original zero
reporting interval; the RPM-only test has since raised that interval to 30
seconds. Configuration changes are the leading explanation for the eData
interruption; the effect of each global/profile change and alternative CAN
causes still require verification against a working configuration.

## Remaining work

- [ ] When ignition and CAN traffic become active, verify fresh parameter `1`
      reports with plausible RPM values over several 30-second intervals. The
      interval is stored, but live RPM recovery is not yet confirmed. If reporting
      remains absent or values are invalid, verify the vehicle profile and decoding
      with the installer/provider before further configuration changes.
- [ ] Confirm the exact hardware/firmware interpretation and compatible vehicle
      profile from the returned version evidence and installer/provider records.
      Recheck reachability and preserve a fresh readback immediately before recovery;
      the snapshot above may change. Do not assume the API's `/parameters` directly
      exposes CAN Engine definitions.
- [ ] Obtain the previous working Monitor export or a verified configuration for
      this installation from the installer/provider, including any separate provider
      configuration archive or outbound command history. The available event history
      contains no usable old configuration. Establish the meaning of `19,0,154,1`
      and correlate available command acknowledgments with submissions.
- [ ] Attempt remote restoration only with the verified configuration and a usable
      device connection. Restore the affected settings/profile/definitions as needed;
      do not use factory reset, guessed payloads or the incident strings as a fallback.
      Check device readback and fresh telemetry after restoration.
- [ ] If remote access/readback is unavailable, the correct configuration cannot be
      established remotely, or reporting cannot be restored and verified, arrange
      on-site work with the installer/technician. Verify power, CAN/eNet connections and
      the installed modules; use the appropriate Monitor software/adaptor to back up,
      diagnose and restore the correct configuration.
- [ ] Verify that the previously observed
      [nine eData parameters](../discocan/erm-resources/karma-api-v2/observed-parameters.md)
      return in fresh reports over multiple configured reporting intervals while CAN
      data is available, and that GPS/event reporting remains functional. Confirm
      persistence across a subsequent normal trip/ignition cycle when practicable.

Close this task only after reporting is restored and verified. General API command
and queue questions remain in the [Karma API backlog](karma-api-v2.md); this file
owns the recovery work for this particular vehicle.
