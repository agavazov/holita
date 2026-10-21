# Karma API v2 reference

Karma API v2 is the external ERM HTTP API consumed by the independent
`apps/karma-client` subgraph. The current integration reads one configured account
through Gateway and exposes it to authenticated admin sessions. A separate internal
machine API executes fixed parameter/profile reads and single-definition additions or
interval changes for Fleet's
[persisted background operations](../../architecture.md#background-device-configuration-reads).
It does not archive telemetry history or synchronize
Fleet Vehicles/Devices with Karma records.

## Contents

For device changes, see [Configuring eData parameter reporting through Karma](../edata-simple-protocol-v4.04/parameter-reporting.md).
It distinguishes implemented read/add/interval operations, manual upstream procedures
and installation-specific evidence limits.

| Document / artifact                                             | Contents                                                                                            |
| --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| [Endpoint catalog](endpoint-catalog.md)                         | Every declared method, path, request field, required/multiple flag and current use                  |
| [Data models](data-models.md)                                   | 102 field mappings and model notes, GraphQL types, validation, omissions and identity boundaries    |
| [Observed eData parameters](observed-parameters.md)             | Twelve encountered parameter IDs and original descriptions, with evidence and interpretation limits |
| [Transport and authentication](transport-and-authentication.md) | Sessions, wire encoding, time semantics, errors, deadlines and cursor mechanics                     |
| [Holita integration](holita-integration.md)                     | Concrete modules, 12 public queries, routes, frontend lifecycle and test ownership                  |
| [Limitations](limitations.md)                                   | Current endpoint/field gaps, adapter assumptions and evidence limits                                |
| [Reconstructed OpenAPI 3.1](openapi.reconstructed.json)         | Machine-readable reference for 20 paths and 32 declared HTTP operations                             |
| [Original source assets](source/README.md)                      | Downloaded vendor help, checksums and structural response evidence                                  |
| [Remaining questions and work](../../../todo/karma-api-v2.md)   | Unresolved provider questions and possible implementation work, kept outside product documentation  |

## Sources and confidence

The public [API help](https://karma.online/apiv2/) loads
[endpoints.js](https://karma.online/apiv2/endpoints.js) and
[help.js](https://karma.online/apiv2/help.js). They provide **27 endpoint entries**,
covering **20 paths / 32 HTTP operations** when five `GET/POST` entries are expanded.
The original HTML, scripts and CSS are retained byte-for-byte under `source/`, with
retrieval metadata and SHA-256 hashes in [manifest.json](source/manifest.json).

No official OpenAPI document was found at the checked public addresses.
`openapi.json`, `swagger.json`, `openapi.yaml`, `swagger.yaml`, `api-docs` and `docs`
under `/apiv2/` returned HTTP 404. This establishes the result for those addresses,
not the absence of a private or differently located vendor specification.

**`openapi.reconstructed.json` is a local reconstruction, not a downloaded vendor
OpenAPI specification.** Request fields come from the public form definitions and
helper. Read response models combine structural observations with the values
accepted by the current adapter. Unknown write responses and unobserved payloads
remain unconstrained. The schema records provenance and `x-holita-implemented`
metadata; it is documentation, not an input to current code generation or runtime
validation.

The schema retains the vendor's multi-value form metadata and also accepts the
single `car` query value used by holita's five telemetry GET reads. Read-model
identity fields retain the non-null scalar types checked by the adapter; this
does not infer an exhaustive vendor required-property list.

The public `/version` returned `2.26.1.1` at retrieval. Retrieval timestamps belong
to source provenance; the value is not a promised compatibility level. Authenticated
read samples establish response structure only for the sampled account and records.
They do not establish global limits, all optional variants, permissions to write,
units, retention or an availability guarantee.

The separate protocol, monitor and historical Karma guides are listed in the
[ERM resource index](../README.md). They document their own versions and do not
establish the current API v2 contract or a device-to-API parameter mapping.

The documentation distinguishes:

- **Vendor help:** a declared path, method or form field, which may still have
  incomplete serialization and validation rules.
- **Structural observation:** a field/type actually returned by a read. An empty
  array proves no element model; a null-only field proves no non-null model.
- **Device configuration observation:** a scoped command, device readback and
  subsequent telemetry establish behavior for the documented installation/profile,
  not a universal device capability or a general holita command interface.
- **Implemented behavior:** a rule enforced by the linked holita source and its
  deterministic fixtures. It can be narrower than upstream capability.
- **Unresolved behavior:** an explicit limitation linked to the backlog, rather
  than a guessed API promise.

## Current integration boundary

Twelve fixed upstream GET reads back the twelve public Karma queries. Internal
`POST /login` supplies the upstream session; the internal configuration reader uses
`POST /commands` for fixed parameter/profile reads and a single additive definition. This uses **14 of
the 32 declared method/path operations**; several reads expose only part of the upstream filters.
The number is an operation inventory, not a claim of complete business coverage.

Implemented reads cover cars/list/detail, eData, last location, trips, events,
driving profile, projects, time zones, API version, users and roles. Fixed machine
operations collect parameter/profile definitions from bounded `GET /events` responses;
Fleet owns scoped reads, catalog-gated additions, interval changes and saved verification.
Public Karma queries remain read-only. Missing areas include driver management,
sensors, vehicle/project writes, `/parameters`, global/profile changes, deletion or arbitrary
device commands, queue status and accident reports. Full comparisons
are in the [catalog](endpoint-catalog.md) and [limitations](limitations.md).

Every Karma GraphQL query requires holita's verified signed session, including
the public upstream version. All authenticated Tenants see the same configured
Karma account; Branch selection does not filter it. This is the current intentional
Karma scope and does not change Fleet Tenant/Branch isolation. The demo login is
not production user identity or membership authorization.

The configuration machine API requires `KARMA_INTERNAL_TOKEN` rather than a
browser session. Fleet validates its own Tenant/Branch Device before queueing work,
captures the explicitly selected Karma identity, and rechecks it before dispatch.
This does not establish a general Karma `device_id` to IMEI mapping or grant shared
account queries permission to change device configuration.

## Maintaining this reference

Refresh public assets from their exact URLs without inserting credentials. Preserve
their bytes, update the manifest hashes and review the source diff before changing
the reconstructed schema or catalog. A changed provider version alone does not
establish which contracts changed.

Reconcile field/model changes against the actual mapper, SDL, generated-operation
inputs and admin views. Keep observations separate from server guarantees and
preserve unknown schemas until supported by evidence. Do not archive raw account
records, credentials, sessions, private URLs or live telemetry as examples here.

Use [Discocan testing](../../testing.md#karma-client-checks) for application checks.
Documentation-only edits need link, JSON/schema, source-integrity and diff checks;
they do not require database fixtures or a full application regression.

Related authoritative behavior: [architecture](../../architecture.md#karma-client),
[development](../../development.md#karma-client) and
[implemented requirements](../../requirements.md).
