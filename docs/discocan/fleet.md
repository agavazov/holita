# Vehicles and Devices implementation index

Sakai owns Angular presentation. Concrete features own contracts, validation and scoped
request lifecycles. Use the existing files directly; there is no generic CRUD layer.

The shared [Simple eData vendor catalog](erm-resources/simple-edata-catalog/README.md)
is implemented by [file validation](../../apps/fleet/src/edata-catalog/catalog-file.ts),
[transactional persistence](../../apps/fleet/src/edata-catalog/catalog.repository.ts)
and a [local CLI](../../apps/fleet/src/edata-catalog/cli.ts). Its offline Python extractor
is [tools/erm-edata/catalog.py](../../tools/erm-edata/catalog.py); it has no API or admin integration.

## Angular foundation

[StoreWorkspace](../../apps/admin/src/app/features/stores/store-workspace.ts) owns authenticated discovery,
session/Store/language routing and the shell. [Login](../../apps/admin/src/app/features/auth/login.ts)
provides an independent layout and sequential Tenant/Store dropdowns. Candidate discovery is retired
on Tenant/language changes; only submitting a valid Store activates the session and opens Vehicles.
The language root redirects signed-in sessions to their saved Store, without a Store list page. Switching Stores preserves
Vehicles/Devices and resets list context. [FleetWorkspace](../../apps/admin/src/app/features/fleet/fleet-workspace.ts)
checks availability/discovery and keys mounted pages/editors by session/Store/language/resource/mode/ID.
[GraphQL transport](../../apps/admin/src/app/core/graphql/graphql-options.ts) captures immutable
session/Store/language headers; each feature API owns its own Apollo client and cache. Retired reads unsubscribe;
submitted writes settle and invalidate only their initiating client.

## Vehicles

- [SDL](../../apps/fleet/src/vehicles/vehicles.graphql), [resolver](../../apps/fleet/src/vehicles/vehicles.resolver.ts), [service](../../apps/fleet/src/vehicles/vehicles.service.ts), [repository](../../apps/fleet/src/vehicles/vehicles.repository.ts).
- [API](../../apps/admin/src/app/features/fleet/vehicles/vehicles-api.ts), [page](../../apps/admin/src/app/features/fleet/vehicles/vehicles-page.ts), [query helpers](../../apps/admin/src/app/features/fleet/vehicles/vehicle-list-query.ts), [editor](../../apps/admin/src/app/features/fleet/vehicles/vehicle-editor.ts), [validation](../../apps/admin/src/app/features/fleet/vehicles/vehicle-validation.ts).

License Plate is required, up to 32 Unicode code points after trimming. Notes is nullable,
multiline, up to 2000. Lists have URL-backed search, pagination/sorting, stable IDs, page-local
selection and confirmed sequential deletion. Assigned Vehicles are protected by Device foreign
keys. Preserve partial successes, failed-row retry, last-page reconciliation and confirmation
retirement. Typed editors keep failed drafts, focus errors and guard dirty navigation.

## Devices

- [SDL](../../apps/fleet/src/devices/devices.graphql), [resolver](../../apps/fleet/src/devices/devices.resolver.ts), [service](../../apps/fleet/src/devices/devices.service.ts), [repository](../../apps/fleet/src/devices/devices.repository.ts).
- [API](../../apps/admin/src/app/features/fleet/devices/devices-api.ts), [page](../../apps/admin/src/app/features/fleet/devices/devices-page.ts), [editor](../../apps/admin/src/app/features/fleet/devices/device-editor.ts), [validation](../../apps/admin/src/app/features/fleet/devices/device-validation.ts).
- [Remote picker](../../apps/admin/src/app/features/fleet/relation-picker.ts).

IMEI is exactly 15 digits and unique per Store, retaining leading zeros. Truck is a mandatory
same-tenant/same-store Vehicle. Multiple Devices can share a Truck; assignment/reassignment is scoped and
protected in persistence. Search/sort/paging, typed forms, null-free mandatory assignments,
dirty guards and sequential deletion use the captured Devices client. Remote picker reads
search/page/hydrate Vehicles through that client and retire obsolete results.

## Boundaries to preserve

Creation checks Store existence through the [Fleet Core client](../../apps/fleet/src/core/core.client.ts)
once per request. Every repository predicate/federation lookup includes verified Tenant and Store scope. No cross-app
implementation imports or shared Prisma models exist. Inputs never own tenantId or storeId. Generated
TypedDocumentNodes/types come from explicit SDL/operation inputs. Backend availability also
gates entity resolution; disabled Angular routes issue no business requests.

See [architecture](architecture.md), [development](development.md) and
[focused checks](testing.md) for current behavior and validation commands.
