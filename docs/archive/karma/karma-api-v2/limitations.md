# Coverage and current limitations

This document describes current behavior and evidence limits. Unresolved provider
questions and possible future work are recorded separately in the
[Karma backlog](../karma-api-v2.md).

## Method coverage

The integration consumes thirteen GET method/path pairs, internal `POST /login` and
`POST /commands` for fixed parameter/profile/rule/logger/diagnostic reads and single-parameter/rule writes. The other seventeen
declared operations are absent from discocan:

| Area                            | Declared operations absent from discocan                    |
| ------------------------------- | --------------------------------------------------------- |
| Cars                            | POST `/cars`, PUT and DELETE `/cars/{id}`                 |
| Drivers                         | GET/POST `/drivers`, PUT/DELETE `/drivers/{id}`           |
| Projects                        | POST `/projects`                                          |
| Alternative telemetry transport | POST `/location`, `/trips`, `/events`, `/driving-profile` |
| Sensors                         | GET/POST `/sensors`                                       |
| Device configuration            | GET/PUT `/parameters`                                     |
| Accident reports                | GET `/black_box/{id}`                                     |

The help does not declare user/role mutations, driver-detail GET, project
update/delete, logout, a parameter-definition catalog, accident discovery, webhooks,
streaming, geofences, reports or video-download operations. Their absence from this
help is not proof that no other ERM interface offers them. The
[web functionality research](web-functionality-research.md#internal-classic-web-methods-and-public-api-alternatives)
identifies separate internal `/i/` operations in current classic/NC2 client sources.
NC2 website sign-in and four visible destinations were inspected, but its UI
functionality and internal contracts must not be assumed to be available through
API v2 or supported for external integration.

## Read parameter coverage

| Implemented read                  | Exposed / fixed use                                                                | Available help fields not exposed                                                                          |
| --------------------------------- | ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Cars                              | Complete unfiltered list; detail by path ID                                        | List `project_id`, `car_id`, `device_id` filters                                                           |
| Users                             | Complete unfiltered list                                                           | `project_id` filter                                                                                        |
| Location                          | One `car`; fixed `fields[]` selection                                              | Multiple cars, devices, custom fields, address language, from/to dates                                     |
| Trips                             | One car, optional paired dates, internal `to_id` cursor                            | Caller `from_id`/`to_id`, multiple cars, devices, projects                                                 |
| Events                            | One car, UTC paired dates, original event codes, selected fields, internal `to_id` | Caller ID ranges, multiple cars/devices/projects, address, decode, custom field selection, local date mode |
| eData                             | One car, UTC paired dates, up to 25 parameter IDs, `showdesc=1`, internal `to_id`  | Caller ID ranges, multiple cars/devices/projects, local date mode, description toggle                      |
| Driving profile                   | One car and required wall-clock period                                             | Multiple cars, devices, projects, omitted date bounds                                                      |
| Projects/time zones/roles/version | Complete fixed read                                                                | No additional endpoint fields declared                                                                     |

Internal cursor bounds are not a general export API. The admin reads a single car
at a time; there is no fleet-wide telemetry report, bulk export or background
historical synchronization. No upstream limit or sort options are exposed.

## Field and model coverage

The [dictionary](data-models.md) maps every field currently preserved by the adapter.
Known omissions include raw `driver_ids` (only their count is exposed), `sim_imsi`,
`sim_phone`, `karma_video_data` and `vehicle_type`. The latter four were observed
only as null, so their non-null models remain unknown. A car's `device_id` is not
validated as a Fleet IMEI. Users and roles remain external reference data.

`/sensors` can return a message envelope, but sampled `sensors` values were null.
The presence of 500 message envelopes does not establish 500 actual sensor readings.
Only an empty driver list was observed. Driver and accident-report models remain
unverified. Manual eData command submissions, single-ID queue reads and device
configuration responses have limited observations documented in the
[configuration reference](../../../discocan/erm-resources/edata-simple-protocol-v4.04/parameter-reporting.md).
They do not establish complete command/queue schemas or general device-command support.

The adapter ignores additional object fields rather than preserving an arbitrary
raw JSON payload. A single malformed row generally fails the complete read. Driving
profile is stricter: its score object must have exactly nine known keys, so a new
provider category would currently cause an availability error until the mapping is
reconciled. Nullable finite values are preserved, without deriving units or labels.

## Contract and semantic limits

- No official OpenAPI was found at the checked public addresses. The reconstruction
  is not a vendor compatibility guarantee or a complete formal validation schema.
- The help is a form specification. Its automatic GET-to-POST conversion and queue
  path arrays leave serialization ambiguities; unknown methods are not promoted
  to established operations solely because the helper offers them.
- Existing trips/profile inputs retain unresolved general wall-clock semantics.
  The separate [daily report](../architecture.md#daily-report-contract) narrows
  support to the proved Europe/Sofia start-day selection; other zones are unsupported.
  Historical car-zone configuration changes remain unknown. Public response timestamp checks validate shape, not full
  calendar validity. `pdt` semantics are unresolved.
- IDs and cursor ordering assume positive safe integers and an ascending source
  batch. Broader ID ranges or reordered batches are rejected rather than coerced.
- The 500-row eData/events allowance is an adapter constraint backed by observed
  batches and controlled fixtures, not an established universal provider limit.
  Trip cap, retention and exhaustive history completeness remain unknown.
- Cursor upper bounds do not freeze active-trip updates, deletions or late-arriving
  lower IDs. Cursors are unsigned navigation metadata. Newer depends on the available
  browser-history trail; Latest is the recovery route.
- eData/events check source adherence to date and code/parameter filters. Trips do
  not re-check date inclusion against unresolved start/stop interval semantics.
- Event-code meanings, sensor definitions, parameter units/scales, speed/distance/
  duration units, score ranges, weights and night-driving definitions are not
  established. Public history `extra` is preserved as text without automatic decoding;
  the internal adapter parses supported parameter `401`, rule `402` and profile `416` layouts.
  The separate diagnostic history decodes supported fault layouts and preserves original payloads.
- Missing and empty states differ by operation. A direct backend eData query does
  not independently verify car existence, unlike location/trips/events/profile.

## Access and operations limits

All authenticated discocan Tenants intentionally see the same configured account.
Karma project memberships do not enforce Tenant/Branch filtering. Fleet's persisted
configuration operations are separately scoped to their Fleet Tenant/Branch
and selected Karma car/device pair, without requiring a local Fleet Device record;
they do not change the shared Karma query scope
or establish a verified general `device_id` to IMEI mapping. The demo session
is not production user identity, membership authorization or a role-permission
model. A future change to access scope requires an explicit domain decision;
the present documentation does not authorize it.

The integration has one in-memory session, bounded login renewal and sanitized
failures. It has no provider logout, proactive session refresh, persistent sessions,
rate-limit scheduler, arbitrary-failure retry/backoff or circuit breaker. Most public
query response reads have no streaming body-size bound; daily report trip reads are
bounded to 2 MiB. The internal configuration reader bounds target responses to
64 KiB and event responses to 2 MiB. Health does
not probe Karma. A valid JSON error can use HTTP 200,
so transport success is distinct from usable business data.

The implemented [background configuration operations](../architecture.md#background-device-configuration-reads)
submit fixed `301` reads (`0702BC`, `1F`, `0802BC`), one `02` parameter definition or
one `04` rule record. The internal machine API validates the selected target,
parameter ID/interval or supported rule frame/expression, and bounded `401`/`402`/`416` observations;
Fleet owns eligibility, complete baseline, persistent intent and readback verification.
Missing fragments, conflicts and incomplete
scan coverage do not become complete configuration evidence. Time-window scans
remain subject to unknown provider retention and late-arrival behavior. Diagnostic
operations additionally poll retained queue IDs; no universal queue-to-device acknowledgment correlation is established. A timeout
or lost submission response stays uncertain and does not trigger automatic replay.

Writes default to disabled. Additions require the exact eligible Monitor catalog and a
fresh observed profile; updates preserve captured fields, including unknown IDs. Both
require conservative 120-second preflight and independent whole-set verification after
the single write attempt. A local ten-minute deadline cannot cancel delayed vendor queue
delivery. A confirmed definition is not proof of available/calibrated measurements or
zero-interval silence. There are no entity writes, global/profile changes, deletion,
arbitrary commands, reset, firmware or server-destination controls. Scoped manual
procedures and installation-specific evidence remain documented separately.
Rule changes additionally require complete parameter and rule baselines and verify
the full returned rule set while preserving unrelated records; unsupported existing
expressions remain opaque rather than becoming authorable.
GET `/parameters?query=...` remains unverified and is not assumed passive because
the help labels it Query Device. Public read permission does not establish
configuration, create or delete permission; the internal endpoints require a
separate machine secret.

## Diagnostic fault coverage

Real `karmaEvents` reads preserve source message IDs, target identities, timestamps
and raw `extra` text. The separate `karmaDiagnosticHistory` decodes `413` and actual
`419` SPN/FMI/status records, while `418`, E2 and E70 remain opaque. It does not create
persistent fault records or establish current vehicle health. Report numbers in that text
are distinct from Karma event-code filters. Fleet's connected **Diagnostics** scenario
uses labelled illustrative records and links separately to real truck history.
Examples, counts and briefs from the scenario source cannot prove live DTC
reading. See the [integration evidence map](discocan-integration.md#diagnostic-evidence-and-product-coverage).

Fixed diagnostic and fault-logger reads use scoped Fleet operations; version/global
commands remain manual upstream procedures. Previously retained queues are reconciled,
but discovery of unrelated commands submitted outside discocan is unavailable.
Queue acceptance or `transmitted` does not establish a device ACK, successful fault
retrieval or a decoded error. A negative/terminal `154,0` reply is not a positive
fault list or proof that the ECU has no faults. A `411` CAN-error flag or `417`
CAN-disconnection report is separate from an ECU DTC and from the full tracker
internal-error/command-result catalogue. Positive SPN/FMI proof requires an actual
`419` source record with applicable decoding and installation context; a vendor
sample or DTC-enabled configuration is insufficient. The
[verification register](../../../discocan/erm-resources/erm-support-diagnostics-protocol-test-server/README.md#verification-register)
records the observed scope and remaining evidence.

See the [backlog](../karma-api-v2.md) for the questions required to
resolve these limits.
