# Coverage and current limitations

This document describes current behavior and evidence limits. Unresolved provider
questions and possible future work are recorded separately in the
[Karma backlog](../../../todo/karma-api-v2.md).

## Method coverage

The integration consumes twelve GET method/path pairs and internal `POST /login`.
The other nineteen declared operations are absent from holita:

| Area                            | Declared operations absent from holita                    |
| ------------------------------- | --------------------------------------------------------- |
| Cars                            | POST `/cars`, PUT and DELETE `/cars/{id}`                 |
| Drivers                         | GET/POST `/drivers`, PUT/DELETE `/drivers/{id}`           |
| Projects                        | POST `/projects`                                          |
| Alternative telemetry transport | POST `/location`, `/trips`, `/events`, `/driving-profile` |
| Sensors                         | GET/POST `/sensors`                                       |
| Device configuration            | GET/PUT `/parameters`                                     |
| Device commands                 | POST `/commands`                                          |
| Accident reports                | GET `/black_box/{id}`                                     |
| Queue status                    | GET `/queue/{id}`                                         |

The help does not declare user/role mutations, driver-detail GET, project
update/delete, logout, a parameter-definition catalog, accident discovery, webhooks,
streaming, geofences, reports or video-download operations. Their absence from this
help is not proof that no other ERM interface offers them. NC2 UI functionality
must not be assumed to be available through API v2.

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
[configuration reference](../edata-simple-protocol-v4.04/parameter-reporting.md).
They do not establish complete command/queue schemas or holita write support.

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
- Trips/profile wall-clock timezone, DST behavior, date-bound inclusivity and trip
  overlap rules are unspecified. Response timestamp checks validate shape, not full
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
  established. `extra` is preserved as text without automatic decoding.
- Missing and empty states differ by operation. A direct backend eData query does
  not independently verify car existence, unlike location/trips/events/profile.

## Access and operations limits

All authenticated holita Tenants intentionally see the same configured account.
Karma project memberships do not enforce Tenant/Branch filtering. The demo session
is not production user identity, membership authorization or a role-permission
model. A future change to access scope requires an explicit domain decision;
the present documentation does not authorize it.

The integration has one in-memory session, bounded login renewal and sanitized
failures. It has no provider logout, proactive session refresh, persistent sessions,
rate-limit scheduler, arbitrary-failure retry/backoff, circuit breaker or streaming
body-size bound. Health does not probe Karma. A valid JSON error can use HTTP 200,
so transport success is distinct from usable business data.

No upstream writes, device queries, commands or queue-driven workflows are
implemented in holita. Scoped manual eData configuration requests have been
verified independently through the upstream API; their procedure and applicability
are documented separately. GET `/parameters?query=...` remains unverified and is
not assumed passive because the help labels it Query Device. Read permission
does not establish command, configuration, create or delete permission.

See the [backlog](../../../todo/karma-api-v2.md) for the questions required to
resolve these limits. Current architecture and API contracts remain unchanged.
