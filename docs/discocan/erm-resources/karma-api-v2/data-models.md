# Data models and field mapping

This dictionary describes the current holita adapter, with structural observations in [response-shapes.json](source/response-shapes.json). GraphQL `!` describes holita nullability, not a formal vendor required-field guarantee. The [reconstructed schema](openapi.reconstructed.json) deliberately permits additional source fields.

## Common validation rules

- Upstream numeric identities are converted to GraphQL ID strings. Positive IDs normally start at 1; explicitly listed codes/references also allow 0. Values must remain safe JavaScript integers.
- Device identifiers remain opaque strings. The API does not establish that they are 15-digit IMEIs or equal Fleet Device.imei.
- Optional scalar helpers generally turn absent/null into null and reject incompatible types. Required text may still be empty unless explicitly checked.
- Finite numbers preserve 0. Numeric strings are not silently converted to metrics or IDs.
- Timestamp fields are nullable strings matching YYYY-MM-DD HH:MM:SS. Response validators check the pattern, not full calendar validity; input validators also check calendar round trips.
- Unknown object properties are generally ignored by holita. The driving-profile score object is an exception: exactly nine known categories are required.
- Arrays are validated as whole responses. A malformed record generally rejects the whole read rather than silently dropping a row. No upstream record cache or raw-payload archive exists.

## Cars (`KarmaCar`)

Sources: [SDL](../../../../apps/karma-client/src/modules/cars/cars.graphql), [runtime mapping](../../../../apps/karma-client/src/modules/cars/cars-response.ts).

| Upstream field     | GraphQL field | GraphQL type | Meaning / handling                                                                                                                    |
| ------------------ | ------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| `car_id`           | `id`          | `ID!`        | Positive safe integer converted to a GraphQL ID string. Detail must match the requested ID.                                           |
| `device_id`        | `deviceId`    | `String!`    | Required opaque text; leading zeros are preserved. No equality with Fleet Device.imei is established.                                 |
| `project_id`       | `projectId`   | `ID!`        | Positive safe integer as text; original ID remains visible if name lookup fails.                                                      |
| `car_number`       | `carNumber`   | `String!`    | Required registration text, not an identity or uniqueness guarantee.                                                                  |
| `car_type`         | `carType`     | `String`     | Optional source text; no controlled vocabulary.                                                                                       |
| `car_year`         | `carYear`     | `String`     | Finite numeric year becomes text; source text is preserved. No model-year range is inferred.                                          |
| `car_color`        | `carColor`    | `String`     | Optional source text.                                                                                                                 |
| `sub_type`         | `subType`     | `String`     | Optional source text; no subtype taxonomy is supplied.                                                                                |
| `time_zone`        | `timeZoneId`  | `Int`        | Nullable integer from 0 through 2147483647; resolved with /time-zones.                                                                |
| `driver_ids`       | `driverCount` | `Int`        | Only array length is exposed. Null/absent becomes null; empty array becomes 0. Element identities/types are not validated or exposed. |
| `sim_imsi`         | —             | —            | Observed only as null. Omitted from GraphQL; non-null type and semantics unknown.                                                     |
| `sim_phone`        | —             | —            | Observed only as null. Omitted from GraphQL; no phone details retained.                                                               |
| `karma_video_data` | —             | —            | Observed only as null. Omitted from GraphQL; video structure and access unknown.                                                      |
| `vehicle_type`     | —             | —            | Observed only as null. Omitted from GraphQL; relation to car_type/sub_type unknown.                                                   |

## eData message (`KarmaEdataMessage`)

Sources: [SDL](../../../../apps/karma-client/src/modules/edata/edata.graphql), [runtime mapping](../../../../apps/karma-client/src/modules/edata/edata-response.ts).

| Upstream field | GraphQL field    | GraphQL type              | Meaning / handling                                                                                        |
| -------------- | ---------------- | ------------------------- | --------------------------------------------------------------------------------------------------------- |
| `message_id`   | `id`             | `ID!`                     | Positive safe integer as text; ascending unique source sequence, displayed newest first.                  |
| `car_id`       | `carId`          | `ID!`                     | Positive safe integer as text, must equal the requested car.                                              |
| `device_id`    | `deviceId`       | `String!`                 | Required opaque string, including leading zeros.                                                          |
| `carnumber`    | `carNumber`      | `String!`                 | Required text. Upstream spelling differs from car_number in cars/trips.                                   |
| `edt`          | `eventTimeUtc`   | `String`                  | Nullable YYYY-MM-DD HH:MM:SS text; compared with requested UTC bounds.                                    |
| `edt_tz`       | `eventTimeLocal` | `String`                  | Nullable source local-time text; no browser conversion or offset is added.                                |
| `pdt`          | `pdt`            | `String`                  | Nullable timestamp text; exact meaning and timezone are unresolved.                                       |
| `spd`          | `spd`            | `Float`                   | Nullable finite number, including 0. Unit and calibration unspecified.                                    |
| `odo`          | `odo`            | `Float`                   | Nullable finite number, including 0. Unit, scale and reset behavior unspecified.                          |
| `latitude`     | `latitude`       | `Float`                   | Nullable finite number; values outside -90..90 reject this eData response.                                |
| `longitude`    | `longitude`      | `Float`                   | Nullable finite number; values outside -180..180 reject this eData response.                              |
| `parameters`   | `parameters`     | `[KarmaEdataParameter!]!` | Required array; duplicate parameter IDs inside a message reject the response. Unknown IDs remain visible. |

## eData parameter (`KarmaEdataParameter`)

Sources: [SDL](../../../../apps/karma-client/src/modules/edata/edata.graphql), [runtime mapping](../../../../apps/karma-client/src/modules/edata/edata-response.ts).

| Upstream field | GraphQL field | GraphQL type | Meaning / handling                                                                                            |
| -------------- | ------------- | ------------ | ------------------------------------------------------------------------------------------------------------- |
| `id`           | `id`          | `ID!`        | Positive safe integer as text. It is not a known unit or a GraphQL field name.                                |
| `value`        | `value`       | `Float`      | Nullable finite numeric reading. No scaling, conversion or unit is invented.                                  |
| `desc`         | `description` | `String`     | Nullable source text requested with showdesc=1; description alone does not establish a reliable unit catalog. |

## Location (`KarmaLocation`)

Sources: [SDL](../../../../apps/karma-client/src/modules/location/location.graphql), [runtime mapping](../../../../apps/karma-client/src/modules/location/location-response.ts).

| Upstream field | GraphQL field | GraphQL type | Meaning / handling                                                                               |
| -------------- | ------------- | ------------ | ------------------------------------------------------------------------------------------------ |
| `car_id`       | `carId`       | `ID!`        | Positive safe integer as text; must match requested car.                                         |
| `device_id`    | `deviceId`    | `String!`    | Required string.                                                                                 |
| `carnumber`    | `carNumber`   | `String!`    | Required string; original upstream spelling.                                                     |
| `message_id`   | `messageId`   | `ID`         | Optional positive safe integer as text.                                                          |
| `eid`          | `eventId`     | `ID`         | Optional nonnegative safe integer as text; code 0 is preserved.                                  |
| `edt`          | `edt`         | `String`     | Nullable source timestamp text, no online/staleness inference.                                   |
| `edt_tz`       | `edtTz`       | `String`     | Nullable source timestamp text, no timezone conversion.                                          |
| `pdt`          | `pdt`         | `String`     | Nullable source timestamp text; semantics unresolved.                                            |
| `latitude`     | `latitude`    | `Float`      | Nullable finite number. Out-of-range values remain inspectable; they cannot generate a map link. |
| `longitude`    | `longitude`   | `Float`      | Nullable finite number. Both valid coordinates are required for a map link; 0 is valid.          |
| `spd`          | `spd`         | `Float`      | Nullable finite number with unknown units.                                                       |
| `odo`          | `odo`         | `Float`      | Nullable finite number with unknown units.                                                       |
| `extra`        | `extra`       | `String`     | Nullable plain text. No automatic JSON/HTML/device-payload decoding.                             |

### Additional upstream voltage fields

Direct upstream `GET /location` and `GET /events` reads can return numeric `vin`
and `vbat` when explicitly selected with repeated `fields[]` query parameters.
These fields were observed on the StarLink Scout vehicle under investigation,
including messages received while the eData diagnostic ignition state was off.
Holita's current location/event adapters and GraphQL models do not request or
expose them.

The field interpretation follows the [flespi ERM parser reference](https://flespi.com/protocols/erm):
`#VIN#` maps to external power-source voltage in volts, and `#VBAT#` to internal
battery voltage in volts. This is an ERM protocol mapping consistent with the
observed values, not a vendor-published Karma field schema. The numeric `vin`
field here is unrelated to a vehicle identification number.

These are tracker message fields, separate from `/edata` parameter definitions.
Adding eData parameter `781` is not required to retrieve them. `/location` reads
the last stored message; compare `message_id` and `edt`/`edt_tz` across records to
establish freshness. A successful API read does not itself force a new device
measurement or establish that the device is continuously awake.

## Trips (`KarmaTrip`)

Sources: [SDL](../../../../apps/karma-client/src/modules/history/history.graphql), [runtime mapping](../../../../apps/karma-client/src/modules/history/history-response.ts).

| Upstream field        | GraphQL field       | GraphQL type | Meaning / handling                                                               |
| --------------------- | ------------------- | ------------ | -------------------------------------------------------------------------------- |
| `trip_id`             | `id`                | `ID!`        | Positive safe integer as text; cursor bounds apply to this ID, not message IDs.  |
| `car_id`              | `carId`             | `ID!`        | Positive safe integer as text, must match requested car.                         |
| `car_number`          | `carNumber`         | `String!`    | Required source text.                                                            |
| `device_id`           | `deviceId`          | `String!`    | Required opaque text.                                                            |
| `driver_id`           | `driverId`          | `ID`         | Nullable nonnegative safe integer as text; 0 remains 0. No driver lookup exists. |
| `trip_active`         | `tripActive`        | `Float`      | Nullable finite number; no boolean conversion or active-state definition.        |
| `start_message_id`    | `startMessageId`    | `ID`         | Nullable nonnegative safe integer as text.                                       |
| `start_date`          | `startDate`         | `String`     | Nullable source timestamp text; provider timezone and overlap semantics unknown. |
| `start_latitude`      | `startLatitude`     | `Float`      | Nullable finite number; backend does not enforce coordinate bounds here.         |
| `start_longitude`     | `startLongitude`    | `Float`      | Nullable finite number; no route reconstruction is implemented.                  |
| `start_odo`           | `startOdo`          | `Float`      | Nullable finite source number; no unit or delta is computed.                     |
| `stop_message_id`     | `stopMessageId`     | `ID`         | Nullable nonnegative safe integer as text, accepted for an unfinished trip.      |
| `stop_date`           | `stopDate`          | `String`     | Nullable source timestamp text; no inferred trip completion.                     |
| `stop_latitude`       | `stopLatitude`      | `Float`      | Nullable finite number; coordinate bounds not checked here.                      |
| `stop_longitude`      | `stopLongitude`     | `Float`      | Nullable finite number; coordinate bounds not checked here.                      |
| `stop_odo`            | `stopOdo`           | `Float`      | Nullable finite source number; reset/rollover semantics unknown.                 |
| `trip_duration`       | `tripDuration`      | `Float`      | Nullable finite source metric; unit unspecified.                                 |
| `trip_distance`       | `tripDistance`      | `Float`      | Nullable finite source metric; unit unspecified.                                 |
| `trip_duration_night` | `tripDurationNight` | `Float`      | Nullable finite source metric; night definition and unit unspecified.            |
| `trip_distance_night` | `tripDistanceNight` | `Float`      | Nullable finite source metric; night definition and unit unspecified.            |
| `max_speed`           | `maxSpeed`          | `Float`      | Nullable finite source metric; unit unspecified.                                 |
| `driving_score`       | `drivingScore`      | `Float`      | Nullable finite source metric; scale and thresholds unspecified.                 |
| `eco_score`           | `ecoScore`          | `Float`      | Nullable finite source metric; scale and aggregation unspecified.                |

## Events (`KarmaEvent`)

Sources: [SDL](../../../../apps/karma-client/src/modules/history/history.graphql), [runtime mapping](../../../../apps/karma-client/src/modules/history/history-response.ts).

| Upstream field | GraphQL field | GraphQL type | Meaning / handling                                                              |
| -------------- | ------------- | ------------ | ------------------------------------------------------------------------------- |
| `message_id`   | `id`          | `ID!`        | Positive safe integer as text; event history cursor key.                        |
| `car_id`       | `carId`       | `ID!`        | Positive safe integer as text, checked against requested car.                   |
| `device_id`    | `deviceId`    | `String!`    | Required opaque string.                                                         |
| `eid`          | `eventId`     | `ID!`        | Required nonnegative safe integer as text; event_type filter selects this code. |
| `edt`          | `edt`         | `String`     | Nullable source timestamp text; UTC filtering is checked against it.            |
| `edt_tz`       | `edtTz`       | `String`     | Nullable source timestamp text returned by fields[] selection.                  |
| `pdt`          | `pdt`         | `String`     | Nullable source timestamp text; semantics unresolved.                           |
| `latitude`     | `latitude`    | `Float`      | Nullable finite number; no geographic bound check here.                         |
| `longitude`    | `longitude`   | `Float`      | Nullable finite number; no geographic bound check here.                         |
| `spd`          | `spd`         | `Float`      | Nullable finite source number returned by fields[] selection.                   |
| `odo`          | `odo`         | `Float`      | Nullable finite source number returned by fields[] selection.                   |
| `extra`        | `extra`       | `String`     | Nullable source text; preserved and escaped, with no automatic interpretation.  |

## Driving profile (`KarmaDrivingProfile`)

Sources: [SDL](../../../../apps/karma-client/src/modules/history/history.graphql), [runtime mapping](../../../../apps/karma-client/src/modules/history/history-response.ts).

| Upstream field | GraphQL field | GraphQL type               | Meaning / handling                                                                                        |
| -------------- | ------------- | -------------------------- | --------------------------------------------------------------------------------------------------------- |
| `car_id`       | `carId`       | `ID!`                      | Positive safe integer as text; must match requested car.                                                  |
| `car_number`   | `carNumber`   | `String!`                  | Required source text.                                                                                     |
| `device_id`    | `deviceId`    | `String!`                  | Required source text.                                                                                     |
| `score`        | `categories`  | `[KarmaDrivingCategory!]!` | Source object becomes an ordered nine-element array. Unknown extra categories reject the current adapter. |

## Driving category (`KarmaDrivingCategory`)

Sources: [SDL](../../../../apps/karma-client/src/modules/history/history.graphql), [runtime mapping](../../../../apps/karma-client/src/modules/history/history-response.ts).

| Upstream field            | GraphQL field | GraphQL type | Meaning / handling                                                                                                    |
| ------------------------- | ------------- | ------------ | --------------------------------------------------------------------------------------------------------------------- |
| `score object key`        | `name`        | `String!`    | One of accelerations, brakes, speed_bumps, bypassing, roundabout, lane_change, turns, off_road, speed, in this order. |
| `score.<category>.score`  | `score`       | `Float`      | Nullable finite source number. No enforced range or overall rating.                                                   |
| `score.<category>.weight` | `weight`      | `Float`      | Nullable finite source number. Normalization, meaning and calculation unknown.                                        |

## Projects (`KarmaProject`)

Sources: [SDL](../../../../apps/karma-client/src/modules/references/references.graphql), [runtime mapping](../../../../apps/karma-client/src/modules/references/references-response.ts).

| Upstream field | GraphQL field | GraphQL type | Meaning / handling                                                             |
| -------------- | ------------- | ------------ | ------------------------------------------------------------------------------ |
| `project_id`   | `id`          | `ID!`        | Positive safe integer as text; duplicate IDs reject the complete list.         |
| `name`         | `name`        | `String!`    | Required source string; no relation to holita Tenant/Branch names is inferred. |

## Time zones (`KarmaTimeZone`)

Sources: [SDL](../../../../apps/karma-client/src/modules/references/references.graphql), [runtime mapping](../../../../apps/karma-client/src/modules/references/references-response.ts).

| Upstream field | GraphQL field | GraphQL type | Meaning / handling                                                    |
| -------------- | ------------- | ------------ | --------------------------------------------------------------------- |
| `zone_id`      | `id`          | `Int!`       | Integer 0..2147483647; duplicate IDs reject the list. Not an offset.  |
| `zone_name`    | `name`        | `String!`    | Required nonblank source text. No DST/offset conversion is performed. |

## Version (`KarmaVersion`)

Sources: [SDL](../../../../apps/karma-client/src/modules/references/references.graphql), [runtime mapping](../../../../apps/karma-client/src/modules/references/references-response.ts).

| Upstream field | GraphQL field | GraphQL type | Meaning / handling                                                       |
| -------------- | ------------- | ------------ | ------------------------------------------------------------------------ |
| `version`      | `version`     | `String!`    | Required nonblank source text; no semantic-version compatibility policy. |

## Users (`KarmaUser`)

Sources: [SDL](../../../../apps/karma-client/src/modules/accounts/accounts.graphql), [runtime mapping](../../../../apps/karma-client/src/modules/accounts/accounts-response.ts).

| Upstream field | GraphQL field | GraphQL type | Meaning / handling                                                                                            |
| -------------- | ------------- | ------------ | ------------------------------------------------------------------------------------------------------------- |
| `user_id`      | `id`          | `ID!`        | Positive safe integer as text; duplicate user IDs reject the complete list.                                   |
| `user_name`    | `userName`    | `String!`    | Required string, including empty text. Not a holita login identity.                                           |
| `active`       | `active`      | `Float!`     | Required finite numeric flag; 0 preserved, no enabled/disabled interpretation.                                |
| `expire_date`  | `expireDate`  | `String`     | Null or string. Missing property is rejected; no timestamp-format or expiry-timezone interpretation.          |
| `role_id`      | `roleId`      | `ID!`        | Positive safe integer as text. Role lookup does not grant admin permissions.                                  |
| `first_name`   | `firstName`   | `String!`    | Required string; plain text.                                                                                  |
| `last_name`    | `lastName`    | `String!`    | Required string; plain text.                                                                                  |
| `time_zone`    | `timeZoneId`  | `Int!`       | Required integer 0..2147483647, looked up without conversion.                                                 |
| `email`        | `email`       | `String!`    | Required string; displayed as text, without a separate semantic email validator.                              |
| `project_id`   | `projectId`   | `ID!`        | Required nonnegative safe integer as text; 0 preserved.                                                       |
| `project_ids`  | `projectIds`  | `[ID!]!`     | Required array of nonnegative safe integers as text. Source order, empty arrays and duplicates are preserved. |

## Roles (`KarmaRole`)

Sources: [SDL](../../../../apps/karma-client/src/modules/accounts/accounts.graphql), [runtime mapping](../../../../apps/karma-client/src/modules/accounts/accounts-response.ts).

| Upstream field | GraphQL field | GraphQL type | Meaning / handling                                                      |
| -------------- | ------------- | ------------ | ----------------------------------------------------------------------- |
| `role_id`      | `id`          | `ID!`        | Positive safe integer as text; duplicate role IDs reject the list.      |
| `description`  | `description` | `String!`    | Required original string; no inferred permission names or capabilities. |

## Unimplemented or unknown models

- **Drivers:** public help specifies create/update input fields (project_id, first_name, last_name, phone_number), but only an empty GET response was observed. A Driver response schema cannot be established from request names.
- **Sensors:** observed envelope fields are car_id, carnumber, device_id, edt, message_id and sensors. The sensors property was null in the sample, so nested reading types, sensor identifiers, units and decoding are unknown.
- **Configuration parameters:** /parameters is separate from /edata. Its cached/query results, value types, device reply and errors are unknown.
- **Commands / queues:** single-device command submissions returned numeric queue-ID arrays. Single-ID queue reads returned objects keyed by the ID, with `state_id` and `state_desc`, including `1` / `transmitted`. These are limited upstream observations, not implemented holita models or a complete delivery/acknowledgment contract. See the [configuration reference](../edata-simple-protocol-v4.04/parameter-reporting.md#command-submission-and-responses).
- **Black box:** accident report structure, encoding, units, sampling, authorization and discovery are unknown.
- **Writes:** create/update/delete response shapes and success codes were not inferred from read responses.
- **Addresses / decode:** requested-address payloads and decoded external-device data have not been observed or integrated.

## Relationship boundaries

Karma car_id, project_id, user_id, role_id, driver_id and zone_id belong to the upstream account. Fleet UUIDs, tenantId, branchId and Device.imei belong to holita. There is no persistent identity mapping, automatic synchronization or cross-domain foreign key. Project memberships and role descriptions are reference data; they do not authorize holita access.
