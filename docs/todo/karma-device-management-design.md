# Karma device management: proposal for approval

Pending production proposal. Routing and device-operation changes require user confirmation.
Connect the shared Storybook device-management presentation to the existing inventory,
truck detail, configuration view/editor, shared patterns and durable operations; avoid a new
management framework or duplicate CRUD screens.

The supplied Monitor 9.56 screenshot, INI/TXT and compiler investigation now establish the
requested command/rule editor capabilities. The sample rules are arbitrary format examples,
not defaults or a deployment request. Use the existing configuration workspace with Parameters
and Rules sections; do not turn the request into inventory filters or a generic command console.
Validation follows the current delivery policy in AGENTS.md, including the 60-case budget;
this draft does not require restoring removed test suites or automatic Storybook review.

## Inventory and identity

Karma returns a combined car/device record from `GET /cars` and `GET /cars/{id}`;
there is no established separate device-inventory endpoint. `car_id` identifies the car
resource; `device_id` is opaque source text, including leading zeros. A read-only inspection
of the configured account on 2026-10-21 returned **10 cars**, 10 distinct car IDs and 10
distinct nonempty device IDs; a detail request agreed with its inventory row. The separate
2026-10-22 research also reports 10 cars with distinct nonempty device IDs. These are
point-in-time observations, not a fixed count or a guarantee that identifiers never change.

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
| `/karma-client/cars/:recordId`                     | Retain truck detail; show Device settings as a truck-profile tab.                                                           |
| `/karma-client/cars/:recordId/configuration`       | Reuse the configuration view/editor for this Karma car, with explicit Fleet scope selection; retain the existing leave guard.      |
| `/:branchId/fleet/devices/:recordId/configuration` | Redirect to Karma inventory carrying only validated scope hints; require car selection because no persistent identity link exists. |

The configuration screen leaves FleetWorkspace; remove its old Fleet navigation entry and
reuse its presentation and tests. Other Fleet Device screens stay. Karma eData/history,
trips, events, location and driving-profile screens stay because they serve distinct reads.
Do not build a second truck or device editor.

Keep settings as a truck-profile tab with Parameters and Rules panels stacked vertically.
Keep record links in inventory, advanced rule fields in the drawer, and show operation
history only when operations exist. Do not expand technical data inside list rows.
Keep existing PageHeader, FormField, TablePanel and feedback patterns. Add a helper to `ui/list` only for demonstrated reuse. No new legacy
Karma stylesheet rules. Add development stories for the changed presentation and retain
desktop/mobile, keyboard, BG/EN, loading/empty/error and technical-disclosure behavior.
Do not restore automatic Storybook tests or visual-baseline updates.

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

## Parameters and rule authoring

Retain the implemented parameter addition and interval change. Display parameter names from the
versioned catalog. Show a physical unit only when retained parameter-specific evidence establishes
it; otherwise show a localized unspecified-unit label. The catalog has no dedicated unit field
and does not establish universal scale or firmware support. Show interval values in seconds. Preserve
the whole original configuration, including unknown IDs/definitions; change only the requested
bytes. Zero keeps its documented special meaning and separate confirmation.

The local [rule-editor specification](../../.misc/rules/web-interface-spec.md#21-editor-capabilities-for-the-implementation-handoff)
and [binary investigation](../../.misc/rules/binary-format.md) supersede the former missing-bytecode
premise. These are Git-ignored local references, not implemented contracts. The screenshot
establishes authoring capabilities; the original Monitor EXE establishes encoding, not firmware behavior.

Create, reopen, edit, duplicate and remove local rules. A right-hand editor starts with
parameter → operator → integer/parameter and supports nested groups, arithmetic and functions.
Offer advanced expression text with a parameter/operator palette over the same ID-based AST.
Switching modes must preserve meaning; invalid text cannot generate bytes. Render explicit
parentheses and spaces rather than assuming ordinary mathematical precedence. Compile the
ID-based model, not localized display names; do not use eval. Preserve imported n-ary node
bytes rather than silently regrouping them into binary expressions.

| Expression part       | Proposed support and evidence limit                                                                                                                                           |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Parameters            | Search configured parameters/catalog by name or ID; store vendor ID and catalog version. Show unresolved inputs; selecting one does not install it.                           |
| Arithmetic            | `+`, `-`, `*`, `/`, `mod`, `--` (absolute difference). Emit binary nodes for new expressions.                                                                                 |
| Comparisons and logic | `=`, `!=`, `>`, `<`, `>=`, `<=`, `and`, `or`; nested groups and integer/parameter/expression operands.                                                                        |
| Functions             | Editable unary `TimeOf`, `Count`, `Sum`, including nested arguments; recovered encoding supports local authoring. Runtime/reset semantics remain unverified.                  |
| Constants and size    | Integers from -65535 through 2147483647; no fractions or scientific notation. RuleData at most 128 bytes. Preserve unsupported negative forms/imports without rewriting them. |
| Units                 | Only parameter-specific documented units; do not infer scale from a name. Debounce is separate from TimeOf and uses 1–32767 milliseconds.                                     |

Keep name, separate true/false event IDs and debounce beside the expression. Event IDs are
numeric with an explicit decimal/hex view: imported `5341` is hex `0x5341`, not decimal 5341.
Zero suppresses the corresponding report. Preserve the dashboard flag on import; do not
enable changing it in this first editor. Show grouped text and generated byte count; raw bytes
and internal IDs belong in technical details. Do not simulate unverified firmware arithmetic or counters.

Save drafts locally in browser storage partitioned by the signed Tenant and selected Karma
car; label that location clearly. They survive reload in that browser, without claiming cloud
or cross-browser persistence. Local draft identity is separate from device rule ID. Duplication
creates a new draft and requires a distinct rule ID before record export/deployment; never
assume sample IDs or two-byte field capacity establish a free supported device ID.

INI import preserves original names, raw definitions, section order and unknown keys. Decode
supported bytecode and expose equation/dependency mismatches; opaque rules remain inspectable
and export unchanged. Derive edited text, bytes and related IDs from the same AST. TXT import
is an inspector, never a batch execution plan. Export local drafts/inspection commands without
claiming Monitor compatibility until round-trip evidence establishes it. Imported parameter,
profile and global settings are source material, never implicit device changes.

Local editing works without Fleet scope or online writes. Each device action requires the
verified Fleet selection above. Keep draft, captured device snapshot and submitted operation
visibly distinct. Local removal does not delete anything in a device.

## Online rule operations proposed for explicit approval

The current fixed command 301 allowlist is `0702BC`, `1F`, and `02` followed by exactly one
22-byte parameter definition. This proposal requests only these extensions:

| Command 301 payload                      | Purpose                      | Protocol evidence and boundary                                                           |
| ---------------------------------------- | ---------------------------- | ---------------------------------------------------------------------------------------- |
| `0802BC`                                 | Read all rules               | Protocol 4.04 §2.3.5/§3.2; assemble complete numbered `402` responses with payload `08`. |
| `04` + exactly one validated rule record | Add/update one selected rule | §2.3.2; a nine-byte record header plus supported RuleData, preserving every other rule.  |

Do not add `03` replace-all, `0B` delete-all, `11` single-device deletion, restart, profile/global
writes or arbitrary hex submission. Device-side deletion is a separate future proposal. This
approval concerns implementing the bounded capabilities; any real-device run still needs its
named target and, for a write, the exact change.

The 2026-10-22 research reports one accepted `0802BC` request but no validated complete `402`
response in five bounded polls. No rule was written. This does not establish an empty rule set
or successful delivery and does not authorize replay. Local editing is not blocked by that result;
device Save and send remains unavailable until its rule baseline/transport requirements are met.
Establish model/firmware support, rule/event allocation and any relevant global settings before
a first live deployment; a missing fact must not silently expand this command proposal.

Karma Client owns fixed rule requests and response parsing. Fleet owns scoped rule intent,
snapshots, history and independent whole-set comparison; no server-side rule evaluation engine.
The current operation kinds/phases and parameter-only SDL cannot represent rules. Extend them
and the stored rule baseline/result through an additive migration, preserving applied history
and `(tenantId, branchId, …)` keys. Reuse existing status values; no new status is proposed.

## Save, recovery and names

Save and send persists one intended change and queues the existing durable operation. Retain
the baseline comparison, 120-second preflight, independent verification read and no replay
after an uncertain write. Rule writes additionally require complete rule and referenced-parameter
baselines; preserve opaque/unrelated rules and change only the selected record. Queue acceptance,
a `404` occurrence or compiler success cannot replace independent complete `402` verification.
Configuration confirmation and observed runtime behavior are separate outcomes.
Refresh, navigation and service restart recover saved operations
and evidence. A lost save response requires reconciliation before another submission; queue
acceptance or submission never confirms application.

Reuse the existing operation states and BG/EN catalog labels. Rule support needs the additive
kind/phase/snapshot changes above, not a new lifecycle state:

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
hex belong in expandable technical details, except explicit event-ID inputs and truthful ID fallbacks.
Keep the original definitions available there. The read/change operation kind must remain visible: a completed read confirms a consistent snapshot; a completed change additionally confirms the independent whole-set comparison. Use registration/model/context labels for the
main truck/device presentation. Rule names are editable local metadata, absent from device
records; show a localized `Rule {id}` fallback on device-only readback.

## Implementation sequence after confirmation

1. Move the existing configuration entry point into Karma with explicit Fleet scope and old-route
   redirects; retain the parameter workflow and proposed identity/scope ADR.
2. Complete the preview's local rule editor with one AST/parser/encoder, persistent drafts and INI/TXT import/export. Support
   arbitrary operator/function combinations within the documented subset, not just the samples.
3. Add durable full-rule reads, `402` evidence/snapshots and the bounded Karma operation.
4. Add a typed one-rule change, 120-second preflight, durable write marker and independent
   whole-set readback. Keep it unavailable when the required baseline/evidence is absent.

Use focused feature commits. Follow the current AGENTS.md test budget/check policy; extend
existing relevant irreversible-write, isolation and cross-service cases rather than restore
removed suites. Compiler vectors belong with the device-contract coverage when that changes.
No real-device experiment or behavior-preserving cleanup is included in this approval.

## References

- [Karma model](../discocan/erm-resources/karma-api-v2/data-models.md) and [endpoints](../discocan/erm-resources/karma-api-v2/endpoint-catalog.md).
- [Architecture and current device operations](../discocan/architecture.md#background-device-configuration-reads).
- [Parameter reporting and retained write evidence](../discocan/erm-resources/edata-simple-protocol-v4.04/parameter-reporting.md).
- [Monitor guide](../discocan/erm-resources/simple-edata-monitor-configuration-v1.0/README.md).
