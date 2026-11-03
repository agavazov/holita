# Historical Karma requirements

Deprecated reference only; these are historical implementation claims.

## Karma Client

| ID        | Historical requirement                                                                                                                                                                                                                                                                                                            |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| KARMA-001 | A separate Karma Client process exposes a signed-session-only common account cars list through Gateway, without Branch scoping or persistence.                                                                                                                                                                                    |
| KARMA-002 | The independent Karma Client admin section provides a read-only BG/EN truck table and Refresh, with loading/error/empty states and retired session/language reads.                                                                                                                                                                |
| KARMA-003 | Registration links open authenticated global truck details with validated IDs, verified basic fields, Refresh/return navigation, missing/error states and retired truck-specific reads.                                                                                                                                           |
| KARMA-004 | A separate truck eData page provides latest-50 cursor pagination (25/50/100), optional paired UTC/parameter-ID filters, complete message/parameter detail, preserved zero/null values and scoped read cancellation.                                                                                                               |
| KARMA-005 | A separate truck location page and independent detail summary preserve all verified last-known fields, null/zero coordinates and plain text; only valid coordinate pairs create a map link, without online-status or unit inference.                                                                                              |
| KARMA-006 | Projects, time zones and API version have separate authenticated global account views; complete reference lists use search and URL-backed local 25/50/100 pagination, resolved names preserve IDs and lookup failures do not block trucks.                                                                                        |
| KARMA-007 | Separate truck Trips/Events histories provide latest-50 scoped cursor paging, paired optional periods, original event-code filters and full raw details; Driving profile provides nine nullable category score/weight pairs for an editable seven-day starting period, with no inferred units/scales/timezone or combined rating. |
| KARMA-008 | Separate signed global Users/Roles menus expose complete account lists with URL search and local 25/50/100 paging (default 50), all eleven user fields in a keyboard-accessible dialog, preserved zero/null/project arrays and original role descriptions without permission inference.                                           |

## Background device configuration reads

Fleet implements [durable background parameter reads and changes](architecture.md#background-device-configuration-reads):
verified Tenant/Branch operations, explicit Karma target selection, leased Nest scheduler,
persisted multipart replies, restart recovery, latest complete snapshots and a refresh-safe
admin page. Separately enabled `ADD_PARAMETER` and `UPDATE_INTERVAL` operations require an
exact-target complete baseline, conservative 120-second preflight, a single additive `02`
definition and independent whole-set readback. Additions require verified Monitor catalog
and observed-profile membership; interval changes preserve existing decoding fields,
including unknown IDs. Requested intervals are integers `0..65000`; zero is Monitor's
not-in-use setting and has separate UI confirmation. Durable write markers prevent automatic
replay after uncertainty/restart. Ten-minute deadlines do not cancel delayed vendor queue
delivery. Configuration confirmation does not verify measurements, and Karma measurement
history is not ingested.
