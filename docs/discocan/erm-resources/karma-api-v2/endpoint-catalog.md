# Endpoint catalog

Source: [original endpoint definitions](source/endpoints.js.txt), [request helper](source/help.js.txt), and [reconstructed OpenAPI](openapi.reconstructed.json). The vendor help declares **27 entries, 20 paths and 32 HTTP operations**. `GET/POST` entries are expanded into two operations in OpenAPI. A method existing in the help does not establish this account's permission to execute it.

## Request conventions

- Paths below are relative to `https://karma.online/apiv2`.
- `required` is the vendor form metadata, not independently established server validation.
- A number control is not proof of an integer/range constraint; the helper collects most values as strings.
- A multi-value field is an array in the helper JSON body. Selecting one switches GET to POST, even for some entries declared GET-only. That helper behavior is not proof of additional supported server methods.
- The Multiple column describes the vendor form. Holita's location/trips/events/profile/eData GET reads use one scalar `car`; the reconstructed schema includes that wire form alongside the multi-value form.
- GET/DELETE put `karma_sid` in the query; POST/PUT put it in JSON, according to the helper. `/version` and `/login` are public entry points.
- Dates use `YYYY-MM-DD HH:MM:SS`. Only events/eData have a documented `date_type=utc` selector in this help.
- The helper substitutes the first populated field into `{id}`. Queue IDs are marked multi-value, but array-to-path semantics are unspecified.
- No generic limit, page, offset, sort or total field is declared. Current 500-row observations do not establish every endpoint's cap.

## Operations and holita coverage

| Method | Path               | Current use                                             |
| ------ | ------------------ | ------------------------------------------------------- |
| GET    | `/version`         | `karmaVersion` (see parameter limitations below)        |
| POST   | `/login`           | Internal server authentication                          |
| GET    | `/cars`            | `karmaCars` (see parameter limitations below)           |
| GET    | `/cars/{id}`       | `karmaCar` (see parameter limitations below)            |
| POST   | `/cars`            | Not implemented in holita                               |
| PUT    | `/cars/{id}`       | Not implemented in holita                               |
| DELETE | `/cars/{id}`       | Not implemented in holita                               |
| GET    | `/drivers`         | Not implemented in holita                               |
| POST   | `/drivers`         | Not implemented in holita                               |
| PUT    | `/drivers/{id}`    | Not implemented in holita                               |
| DELETE | `/drivers/{id}`    | Not implemented in holita                               |
| GET    | `/projects`        | `karmaProjects` (see parameter limitations below)       |
| POST   | `/projects`        | Not implemented in holita                               |
| GET    | `/users`           | `karmaUsers` (see parameter limitations below)          |
| GET    | `/location`        | `karmaLocation` (see parameter limitations below)       |
| POST   | `/location`        | Not implemented in holita                               |
| GET    | `/trips`           | `karmaTrips` (see parameter limitations below)          |
| POST   | `/trips`           | Not implemented in holita                               |
| GET    | `/events`          | `karmaEvents` (see parameter limitations below)         |
| POST   | `/events`          | Not implemented in holita                               |
| GET    | `/sensors`         | Not implemented in holita                               |
| POST   | `/sensors`         | Not implemented in holita                               |
| GET    | `/driving-profile` | `karmaDrivingProfile` (see parameter limitations below) |
| POST   | `/driving-profile` | Not implemented in holita                               |
| GET    | `/parameters`      | Not implemented in holita                               |
| PUT    | `/parameters`      | Not implemented in holita                               |
| POST   | `/commands`        | Not implemented in holita                               |
| GET    | `/edata`           | `karmaEdata` (see parameter limitations below)          |
| GET    | `/black_box/{id}`  | Not implemented in holita                               |
| GET    | `/queue/{id}`      | Not implemented in holita                               |
| GET    | `/time-zones`      | `karmaTimeZones` (see parameter limitations below)      |
| GET    | `/roles`           | `karmaRoles` (see parameter limitations below)          |

## GET `/version` — Version

Get API version information (no authentication required).

Upstream GET is public; holita still requires its signed admin session. Only version text is exposed.

No endpoint-specific request fields are declared (session handling is separate).

## POST `/login` — Login

Authenticate with username and password to receive session ID.

Internal POST only. Credentials and session stay on the server. No logout/refresh-token endpoint is declared.

| Field      | Location  | Form type | Required | Multiple | Options / format |
| ---------- | --------- | --------- | -------- | -------- | ---------------- |
| `user`     | JSON body | text      | yes      | no       | —                |
| `password` | JSON body | password  | yes      | no       | —                |

## GET `/cars` — List Cars

Retrieve list of all cars with optional filtering.

GET is implemented without any upstream filters. POST is not implemented; Fleet Vehicle/Device creation does not create a Karma car.

| Field        | Location | Form type | Required | Multiple | Options / format |
| ------------ | -------- | --------- | -------- | -------- | ---------------- |
| `project_id` | query    | number    | no       | no       | —                |
| `car_id`     | query    | number    | no       | no       | —                |
| `device_id`  | query    | text      | no       | no       | —                |

## GET `/cars/{id}` — Get Car

Retrieve detailed information for a specific car.

GET returns an array, not an object, in the observed service. Holita accepts one matching record or a missing result. PUT/DELETE are not implemented. Update metadata lists only registration/type/year/color, not device/project/time zone.

| Field    | Location    | Form type | Required | Multiple | Options / format |
| -------- | ----------- | --------- | -------- | -------- | ---------------- |
| `car_id` | path `{id}` | number    | yes      | no       | —                |

## POST `/cars` — Create Car

Create a new car record in the system.

GET is implemented without any upstream filters. POST is not implemented; Fleet Vehicle/Device creation does not create a Karma car.

| Field        | Location  | Form type | Required | Multiple | Options / format |
| ------------ | --------- | --------- | -------- | -------- | ---------------- |
| `device_id`  | JSON body | text      | yes      | no       | —                |
| `project_id` | JSON body | number    | yes      | no       | —                |
| `time_zone`  | JSON body | number    | yes      | no       | —                |
| `car_number` | JSON body | text      | yes      | no       | —                |
| `car_type`   | JSON body | text      | no       | no       | —                |
| `car_year`   | JSON body | number    | no       | no       | —                |
| `car_color`  | JSON body | text      | no       | no       | —                |

## PUT `/cars/{id}` — Update Car

Update information for an existing car.

GET returns an array, not an object, in the observed service. Holita accepts one matching record or a missing result. PUT/DELETE are not implemented. Update metadata lists only registration/type/year/color, not device/project/time zone.

| Field        | Location    | Form type | Required | Multiple | Options / format |
| ------------ | ----------- | --------- | -------- | -------- | ---------------- |
| `car_id`     | path `{id}` | number    | yes      | no       | —                |
| `car_number` | JSON body   | text      | no       | no       | —                |
| `car_type`   | JSON body   | text      | no       | no       | —                |
| `car_year`   | JSON body   | number    | no       | no       | —                |
| `car_color`  | JSON body   | text      | no       | no       | —                |

## DELETE `/cars/{id}` — Delete Car

Remove a car from the system.

GET returns an array, not an object, in the observed service. Holita accepts one matching record or a missing result. PUT/DELETE are not implemented. Update metadata lists only registration/type/year/color, not device/project/time zone.

| Field    | Location    | Form type | Required | Multiple | Options / format |
| -------- | ----------- | --------- | -------- | -------- | ---------------- |
| `car_id` | path `{id}` | number    | yes      | no       | —                |

## GET `/drivers` — List Drivers

Retrieve list of all drivers with optional filtering.

No driver module, GraphQL query or UI exists. Only an empty live list was observed; response fields remain unknown. Creation fields are request metadata, not a proven response schema.

| Field        | Location | Form type | Required | Multiple | Options / format |
| ------------ | -------- | --------- | -------- | -------- | ---------------- |
| `project_id` | query    | number    | no       | no       | —                |

## POST `/drivers` — Create Driver

Create a new driver record in the system.

No driver module, GraphQL query or UI exists. Only an empty live list was observed; response fields remain unknown. Creation fields are request metadata, not a proven response schema.

| Field          | Location  | Form type | Required | Multiple | Options / format |
| -------------- | --------- | --------- | -------- | -------- | ---------------- |
| `project_id`   | JSON body | number    | yes      | no       | —                |
| `first_name`   | JSON body | text      | yes      | no       | —                |
| `last_name`    | JSON body | text      | yes      | no       | —                |
| `phone_number` | JSON body | text      | no       | no       | —                |

## PUT `/drivers/{id}` — Update Driver

Update information for an existing driver.

PUT/DELETE only are declared; the help has no GET driver detail. IDs are placed in the path. Responses and relation/deletion semantics are unknown.

| Field          | Location    | Form type | Required | Multiple | Options / format |
| -------------- | ----------- | --------- | -------- | -------- | ---------------- |
| `driver_id`    | path `{id}` | number    | yes      | no       | —                |
| `first_name`   | JSON body   | text      | no       | no       | —                |
| `last_name`    | JSON body   | text      | no       | no       | —                |
| `phone_number` | JSON body   | text      | no       | no       | —                |

## DELETE `/drivers/{id}` — Delete Driver

Remove a driver from the system.

PUT/DELETE only are declared; the help has no GET driver detail. IDs are placed in the path. Responses and relation/deletion semantics are unknown.

| Field       | Location    | Form type | Required | Multiple | Options / format |
| ----------- | ----------- | --------- | -------- | -------- | ---------------- |
| `driver_id` | path `{id}` | number    | yes      | no       | —                |

## GET `/projects` — List Projects

Retrieve list of all projects.

GET is a complete account reference list. POST creation is not implemented. No project update/delete methods are declared.

No endpoint-specific request fields are declared (session handling is separate).

## POST `/projects` — Create Project

Create a new project in the system.

GET is a complete account reference list. POST creation is not implemented. No project update/delete methods are declared.

| Field  | Location  | Form type | Required | Multiple | Options / format |
| ------ | --------- | --------- | -------- | -------- | ---------------- |
| `name` | JSON body | text      | yes      | no       | —                |

## GET `/users` — List Users

Retrieve list of all users with optional filtering.

GET is implemented as the complete account list. project_id filtering is not exposed. No user create/update/delete or role-assignment operation is declared.

| Field        | Location | Form type | Required | Multiple | Options / format |
| ------------ | -------- | --------- | -------- | -------- | ---------------- |
| `project_id` | query    | number    | no       | no       | —                |

## GET/POST `/location` — Location

Retrieve last known location data for vehicles.

Holita uses GET with one scalar car and fields[]=spd, odo, edt_tz, pdt. It does not expose device/bulk/date/address selectors or POST. The help has no date_type selector here.

For a direct upstream voltage read, use `GET /location` with `car` and repeated
`fields[]=vin`, `fields[]=vbat`, `fields[]=edt_tz` selectors, plus the usual session
authentication. These observed tracker fields are not currently exposed by
holita. See [voltage meanings and freshness limits](data-models.md#additional-upstream-voltage-fields).

| Field       | Location                                | Form type | Required | Multiple | Options / format                      |
| ----------- | --------------------------------------- | --------- | -------- | -------- | ------------------------------------- |
| `car`       | query for GET/DELETE; JSON for POST/PUT | number    | no       | yes      | —                                     |
| `device`    | query for GET/DELETE; JSON for POST/PUT | text      | no       | yes      | —                                     |
| `fields`    | query for GET/DELETE; JSON for POST/PUT | text      | no       | yes      | —                                     |
| `address`   | query for GET/DELETE; JSON for POST/PUT | select    | no       | no       | ``: None; `en`: English; `he`: Hebrew |
| `from_date` | query for GET/DELETE; JSON for POST/PUT | datetime  | no       | no       | YYYY-MM-DD HH:MM:SS                   |
| `to_date`   | query for GET/DELETE; JSON for POST/PUT | datetime  | no       | no       | YYYY-MM-DD HH:MM:SS                   |

## GET/POST `/trips` — Trips

Retrieve historical trip data with filtering options.

Holita uses GET for one car, paired optional wall-clock dates and internal to_id pagination over trip_id. from_id, bulk/device/project selectors and POST are not exposed. No provider timezone or batch cap is established.

| Field        | Location                                | Form type | Required | Multiple | Options / format    |
| ------------ | --------------------------------------- | --------- | -------- | -------- | ------------------- |
| `from_id`    | query for GET/DELETE; JSON for POST/PUT | number    | no       | no       | —                   |
| `to_id`      | query for GET/DELETE; JSON for POST/PUT | number    | no       | no       | —                   |
| `car`        | query for GET/DELETE; JSON for POST/PUT | number    | no       | yes      | —                   |
| `device`     | query for GET/DELETE; JSON for POST/PUT | text      | no       | yes      | —                   |
| `project_id` | query for GET/DELETE; JSON for POST/PUT | number    | no       | yes      | —                   |
| `from_date`  | query for GET/DELETE; JSON for POST/PUT | datetime  | no       | no       | YYYY-MM-DD HH:MM:SS |
| `to_date`    | query for GET/DELETE; JSON for POST/PUT | datetime  | no       | no       | YYYY-MM-DD HH:MM:SS |

## GET/POST `/events` — Events

Retrieve historical event data with filtering options.

Holita uses GET for one car, date_type=utc, fields[] selections, paired dates, event_type[] codes and internal to_id pagination over message_id. from_id, address, decode, bulk/device/project selection and POST are not exposed.

Direct upstream reads also accept `fields[]=vin` and `fields[]=vbat` to inspect
voltage across historical messages. Availability on a message is device-dependent;
see [the observed voltage fields](data-models.md#additional-upstream-voltage-fields).

| Field        | Location                                | Form type | Required | Multiple | Options / format                      |
| ------------ | --------------------------------------- | --------- | -------- | -------- | ------------------------------------- |
| `from_id`    | query for GET/DELETE; JSON for POST/PUT | number    | no       | no       | —                                     |
| `to_id`      | query for GET/DELETE; JSON for POST/PUT | number    | no       | no       | —                                     |
| `fields`     | query for GET/DELETE; JSON for POST/PUT | text      | no       | yes      | —                                     |
| `address`    | query for GET/DELETE; JSON for POST/PUT | select    | no       | no       | ``: None; `en`: English; `he`: Hebrew |
| `car`        | query for GET/DELETE; JSON for POST/PUT | number    | no       | yes      | —                                     |
| `device`     | query for GET/DELETE; JSON for POST/PUT | text      | no       | yes      | —                                     |
| `project_id` | query for GET/DELETE; JSON for POST/PUT | number    | no       | yes      | —                                     |
| `event_type` | query for GET/DELETE; JSON for POST/PUT | number    | no       | yes      | —                                     |
| `from_date`  | query for GET/DELETE; JSON for POST/PUT | datetime  | no       | no       | YYYY-MM-DD HH:MM:SS                   |
| `to_date`    | query for GET/DELETE; JSON for POST/PUT | datetime  | no       | no       | YYYY-MM-DD HH:MM:SS                   |
| `date_type`  | query for GET/DELETE; JSON for POST/PUT | select    | no       | no       | ``: Local time (default); `utc`: UTC  |
| `decode`     | query for GET/DELETE; JSON for POST/PUT | checkbox  | no       | no       | —                                     |

## GET/POST `/sensors` — Sensors

Retrieve sensor data with filtering options.

No holita transport, schema or page exists. Read samples show a message envelope whose sensors field is null; this does not establish usable sensor readings or their structure.

| Field        | Location                                | Form type | Required | Multiple | Options / format    |
| ------------ | --------------------------------------- | --------- | -------- | -------- | ------------------- |
| `from_id`    | query for GET/DELETE; JSON for POST/PUT | number    | no       | no       | —                   |
| `to_id`      | query for GET/DELETE; JSON for POST/PUT | number    | no       | no       | —                   |
| `car`        | query for GET/DELETE; JSON for POST/PUT | number    | no       | yes      | —                   |
| `device`     | query for GET/DELETE; JSON for POST/PUT | text      | no       | yes      | —                   |
| `project_id` | query for GET/DELETE; JSON for POST/PUT | number    | no       | yes      | —                   |
| `event_type` | query for GET/DELETE; JSON for POST/PUT | number    | no       | yes      | —                   |
| `from_date`  | query for GET/DELETE; JSON for POST/PUT | datetime  | no       | no       | YYYY-MM-DD HH:MM:SS |
| `to_date`    | query for GET/DELETE; JSON for POST/PUT | datetime  | no       | no       | YYYY-MM-DD HH:MM:SS |

## GET/POST `/driving-profile` — Driving Profile

Retrieve driving profile analytics data.

Holita uses GET for one car and requires a from/to wall-clock period. Bulk/device/project selection and POST are not exposed. Nine category score/weight pairs are preserved without a combined rating.

| Field        | Location                                | Form type | Required | Multiple | Options / format    |
| ------------ | --------------------------------------- | --------- | -------- | -------- | ------------------- |
| `car`        | query for GET/DELETE; JSON for POST/PUT | number    | no       | yes      | —                   |
| `device`     | query for GET/DELETE; JSON for POST/PUT | text      | no       | yes      | —                   |
| `project_id` | query for GET/DELETE; JSON for POST/PUT | number    | no       | yes      | —                   |
| `from_date`  | query for GET/DELETE; JSON for POST/PUT | datetime  | no       | no       | YYYY-MM-DD HH:MM:SS |
| `to_date`    | query for GET/DELETE; JSON for POST/PUT | datetime  | no       | no       | YYYY-MM-DD HH:MM:SS |

## GET `/parameters` — Get Parameters

Retrieve device configuration parameters.

Neither GET nor PUT is implemented. These are device configuration parameters, distinct from /edata readings. query may request a device interaction, so GET is not assumed passive. Value-array alignment, validation and responses are unknown.

| Field      | Location | Form type | Required | Multiple | Options / format |
| ---------- | -------- | --------- | -------- | -------- | ---------------- |
| `car_id`   | query    | number    | yes      | yes      | —                |
| `param_id` | query    | number    | yes      | yes      | —                |
| `query`    | query    | checkbox  | no       | no       | —                |

## PUT `/parameters` — Set Parameters

Update device configuration parameters.

Neither GET nor PUT is implemented. These are device configuration parameters, distinct from /edata readings. query may request a device interaction, so GET is not assumed passive. Value-array alignment, validation and responses are unknown.

| Field      | Location  | Form type | Required | Multiple | Options / format |
| ---------- | --------- | --------- | -------- | -------- | ---------------- |
| `car_id`   | JSON body | number    | yes      | yes      | —                |
| `param_id` | JSON body | number    | yes      | yes      | —                |
| `value`    | JSON body | text      | yes      | yes      | —                |

## POST `/commands` — Send Command

Send command message to one or more devices.

Not implemented in holita. Manual single-device eData requests used a one-element
`car_id` array, a command string and `karma_sid`, and returned numeric queue-ID
arrays. Selected parameter updates were verified by device readback and subsequent
measurements; see the [configuration procedure and evidence limits](../edata-simple-protocol-v4.04/parameter-reporting.md).
This does not establish a universal command catalog, permissions, bulk behavior,
acknowledgment correlation, idempotency or delivery guarantees.

| Field     | Location  | Form type | Required | Multiple | Options / format |
| --------- | --------- | --------- | -------- | -------- | ---------------- |
| `car_id`  | JSON body | number    | yes      | yes      | —                |
| `message` | JSON body | text      | yes      | no       | —                |

## GET `/edata` — eData request

Request the received eData parameters.

Holita uses GET for one scalar car, date_type=utc, showdesc=1, optional paired dates, parameter_id[] and internal to_id. from_id, bulk/device/project selectors are not exposed. Help.js can switch this GET-only entry to POST when arrays are selected; that POST capability is not established.

| Field          | Location | Form type | Required | Multiple | Options / format                     |
| -------------- | -------- | --------- | -------- | -------- | ------------------------------------ |
| `from_id`      | query    | number    | no       | no       | —                                    |
| `to_id`        | query    | number    | no       | no       | —                                    |
| `car`          | query    | number    | no       | yes      | —                                    |
| `device`       | query    | text      | no       | yes      | —                                    |
| `project_id`   | query    | number    | no       | yes      | —                                    |
| `parameter_id` | query    | number    | no       | yes      | —                                    |
| `showdesc`     | query    | checkbox  | no       | no       | —                                    |
| `from_date`    | query    | datetime  | no       | no       | YYYY-MM-DD HH:MM:SS                  |
| `to_date`      | query    | datetime  | no       | no       | YYYY-MM-DD HH:MM:SS                  |
| `date_type`    | query    | select    | no       | no       | ``: Local time (default); `utc`: UTC |

## GET `/black_box/{id}` — eSafe accident request

Request a specific accident report.

No holita implementation or report sample. Accident ID is a text path value. No accident discovery/list endpoint or report schema is supplied in the help.

| Field         | Location    | Form type | Required | Multiple | Options / format |
| ------------- | ----------- | --------- | -------- | -------- | ---------------- |
| `accident_id` | path `{id}` | text      | yes      | no       | —                |

## GET `/queue/{id}` — Get queued messages state

Get status of queued messages.

No holita implementation. Direct `GET /queue/{id}` reads for a single numeric ID
returned an object keyed by that ID with `state_id` and `state_desc`; state `1` /
`transmitted` was observed. It does not prove an applied device configuration.
The complete state model, terminal conditions and bulk path grammar remain
unresolved. The vendor form marks queue_id as multi-value despite a single path
placeholder and can switch to POST; that does not establish POST support.

| Field      | Location    | Form type | Required | Multiple | Options / format |
| ---------- | ----------- | --------- | -------- | -------- | ---------------- |
| `queue_id` | path `{id}` | number    | yes      | yes      | —                |

## GET `/time-zones` — Time Zones

Retrieve list of available time zones.

Complete GET lookup implemented. Numeric IDs are vendor references, not offsets. No time-zone write methods are declared.

No endpoint-specific request fields are declared (session handling is separate).

## GET `/roles` — Roles

Retrieve list of available user roles.

Complete GET lookup implemented. Description text is preserved. No permission matrix or role write methods are declared.

No endpoint-specific request fields are declared (session handling is separate).

## Response knowledge

Response fields for implemented reads and observed omissions are listed in
[Data models](data-models.md). The limited command/queue observations above have
not been promoted to complete response schemas. Unknown write results, driver
rows, non-null sensor payloads, accident reports and queue states intentionally
remain unconstrained in the reconstructed schema. Consult the
[remaining questions](../../../todo/karma-api-v2.md) before treating this reference
as a complete upstream contract.
