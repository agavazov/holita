# Karma device management: proposal for approval

Pending proposal. Implement only after user confirmation. Reuse the existing inventory,
truck detail, configuration view/editor, shared patterns and durable operations; avoid a new
management framework or duplicate CRUD screens.

## Inventory and identity

Karma returns a combined car/device record from `GET /cars` and `GET /cars/{id}`;
there is no established separate device-inventory endpoint. `car_id` identifies the car
resource; `device_id` is opaque source text, including leading zeros. A read-only inspection
of the configured account on 2026-10-21 returned **10 cars**, 10 distinct car IDs and 10
distinct nonempty device IDs; a detail request agreed with its inventory row. This is an
observation, not a fixed count or a guarantee that identifiers never change.

Load inventory automatically from the configured account, with loading, empty, error and
retry states. Do not create placeholder records. Registration text and the observed
15-digit device IDs do not prove equality with an IMEI. Fleet's scoped Device UUID and IMEI
remain separate identifiers. Reconfirm the selected car/device pair before every operation.

Keep explicit per-request target selection; add no persistent links, synchronization or
automatic reconciliation. Missing Fleet context gets a scope/device selector. Missing or
changed upstream identity blocks operations and asks for reselection; ambiguous candidates
are never chosen automatically. Record this decision in the [proposed identity/scope ADR](karma-device-management-identity-adr.md).

## Screens and routes

All paths below follow the existing `/:language` prefix.

| Route                                              | Proposed behavior                                                                                                                  |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `/karma-client/cars`                               | Retain automatic inventory; each truck opens its existing detail.                                                                  |
| `/karma-client/cars/:recordId`                     | Retain truck detail; show its device and a clear Device settings action.                                                           |
| `/karma-client/cars/:recordId/configuration`       | Reuse the configuration view/editor for this Karma car, with explicit Fleet scope selection; retain the existing leave guard.      |
| `/:branchId/fleet/devices/:recordId/configuration` | Redirect to Karma inventory carrying only validated scope hints; require car selection because no persistent identity link exists. |

The configuration screen leaves FleetWorkspace; remove its old Fleet navigation entry and
reuse its presentation and tests. Other Fleet Device screens stay. Karma eData/history,
trips, events, location and driving-profile screens stay because they serve distinct reads.
Do not build a second truck or device editor.

Use a small layout: truck/device context, current settings plus one-change editor, then
saved operation history. Keep existing PageHeader, FormField, TablePanel, disclosures and
feedback patterns. Add a helper to `ui/list` only for demonstrated reuse. No new legacy
Karma stylesheet rules. Cover the changed presentation with stories and desktop/mobile,
keyboard, BG/EN, loading/empty/error and technical-disclosure checks.

## Authorization and lifecycle

Karma inventory/detail remain `requiresBranch: false` and usable without Fleet. Opening
configuration loads the session's authorized Core Branch choices, then Devices only for the
chosen Branch. `branchId` and local `deviceId` query parameters may restore a selection but
are untrusted hints: resolve and authorize both before showing Fleet data or enabling actions.
Karma account visibility grants no Tenant/Branch authority.

Reuse a concrete Fleet operations client keyed to verified session, language, Branch and
local Device; capture the selected car ID and expected opaque device ID separately. Retire
watches, timers and late UI callbacks whenever any scope/target changes. Keep inventory
queries independent of that client. Every Fleet resolver/repository/worker still verifies
Tenant/Branch. Durable jobs and history remain in Fleet; provider calls remain in Karma Client
and Fleet uses the existing machine-authenticated internal endpoints. Add no mapping table
or authorization shortcut.

## Supported changes and protocol limits

Retain the implemented parameter addition and interval change. Display parameter names from the
versioned catalog. Show a physical unit only when retained parameter-specific evidence establishes
it; otherwise show a localized unspecified-unit label. The catalog has no dedicated unit field
and does not establish universal scale or firmware support. Show interval values in seconds. Preserve
the whole original configuration, including unknown IDs/definitions; change only the requested
bytes. Zero keeps its documented special meaning and separate confirmation.

The retained Monitor guide's pages 11–16 support these authoring concepts, not a wire encoder:

| Parameter / expression          | Operator and value                             | Unit / combination evidence                                                                                                                                   |
| ------------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Fuel Level %                    | greater than 50                                | Percent; TimeOf reports after the condition holds for more than 5000 milliseconds.                                                                            |
| ACC                             | equals 1; occurrence threshold greater than 10 | Discrete value and occurrence count. The prose calls this Count, while its printed formula says Sum; do not resolve that inconsistency by inventing bytecode. |
| Available configured parameters | equality/inequality and ordered comparisons    | Values use the parameter's documented physical unit; no generic unit field is established.                                                                    |
| Boolean expressions             | AND / OR, parentheses                          | Multiple parameters/operators are supported; precedence and operand encoding require retained evidence.                                                       |

The guide describes parameter/value comparisons (`=`, `!=`, `>`, `<`, `>=`,
`<=`), arithmetic and `AND`/`OR`, plus functions. Established physical units are presentation
metadata, not an invented wire field. Protocol 4.04 describes the `04` rule envelope, but the retained
evidence does not establish the RuleData bytecode/operand encoding required to author such
conditions safely. Therefore do not implement a condition writer or server-side rule engine.
Obtain that encoding evidence before proposing a condition editor/write extension.

The fixed command 301 allowlist stays `0702BC`, `1F`, and `02` followed by exactly one
22-byte definition. **No new write kind is proposed for approval.** Additional rule commands
require both complete protocol evidence and separate explicit user approval.

## Save, recovery and names

Save and send persists one intended change and queues the existing durable operation. Retain
the baseline comparison, 120-second preflight, independent verification read and no replay
after an uncertain write. Refresh, navigation and service restart recover saved operations
and evidence. A lost save response requires reconciliation before another submission; queue
acceptance or submission never confirms application.

Reuse the existing operation states and BG/EN catalog labels; no new persistent state or
migration is needed:

| State      | BG label                                        | EN label                                    |
| ---------- | ----------------------------------------------- | ------------------------------------------- |
| QUEUED     | На опашка                                       | Queued                                      |
| SUBMITTING | Изпращане на заявката                           | Sending request                             |
| WAITING    | Изчакване на устройството                       | Waiting for device                          |
| UNKNOWN    | Изпращането е непотвърдено; проверка за отговор | Submission uncertain; checking for response |
| COMPLETE   | Конфигурацията е потвърдена                     | Configuration confirmed                     |
| TIMED_OUT  | Няма пълен отговор преди крайния срок           | No complete response before the deadline    |
| FAILED     | Операцията е неуспешна                          | Operation failed                            |

Actions, settings and status labels come from the existing feature BG/EN catalogs. Add small
explicit translations for the catalog parameters shown as named choices; preserve original
catalog titles in technical details. An unknown/untranslated parameter gets a truthful localized
`Parameter {id}` fallback, never a guessed meaning. Numeric IDs, IMEI, protocol codes and raw
hex belong in expandable technical details, except the required unknown-parameter ID fallback.
Keep the original definitions available there. The read/change operation kind must remain visible: a completed read confirms a consistent snapshot; a completed change additionally confirms the independent whole-set comparison. Use registration/model/context labels for the
main truck/device presentation.

## References

- [Karma model](../discocan/erm-resources/karma-api-v2/data-models.md) and [endpoints](../discocan/erm-resources/karma-api-v2/endpoint-catalog.md).
- [Architecture and current device operations](../discocan/architecture.md#background-device-configuration-reads).
- [Parameter reporting and retained write evidence](../discocan/erm-resources/edata-simple-protocol-v4.04/parameter-reporting.md).
- [Monitor guide](../discocan/erm-resources/simple-edata-monitor-configuration-v1.0/README.md).
