# Discocan development

Use the [shared development guide](../development.md) for installation, host processes,
environment, database setup, Sakai references and Angular agent tools.
The current implementation uses Store terminology; see [the domain index](README.md#terminology).

## Telemetry admin

Prepare databases, migrate and seed, then run `npm run dev` and open
[Angular admin](http://127.0.0.1:11000). Choose RentalSofia in the Tenant dropdown, then choose a Store in the second dropdown and sign in to open Vehicles. Login has its own Sakai layout without the application header/sidebar. Vehicles and Devices are under Fleet; the header Store selector switches the active Store.
`dev:admin` runs Angular alone when the backends are available. Development defaults to `/bg`;
`/en` selects English. Store/language/list query survive reloads. Language switching keeps
path/query/hash; Store switching preserves Vehicles/Devices and resets the list context.

The shell uses Sakai, local Lato and PrimeNG Aura compatibility tokens. Desktop navigation can
collapse; mobile navigation opens a modal Drawer. Below 992px one Store selector moves into a
second 56px header row. Resizing preserves drafts and closes obsolete overlays.
Themes persist in `holita.admin.theme`; denied storage displays a status message.

`apps/admin/public/config.json` supplies `graphqlUrl`, optional boolean `fleetEnabled`
and optional `primeUiLicense`. GraphQL may use a root-relative endpoint or an absolute HTTP(S)
URL without credentials/fragment. The development proxy forwards `/graphql` to Gateway.
Startup validates configuration before bootstrap and displays a localized error on failure.
Issued license keys stay private and must not be committed. Browser fixtures use their own config.
`fleetEnabled` defaults true; false hides business navigation and blocks direct routes,
without business requests. Store discovery stays usable. Backend availability is separately
controlled by `FLEET_ENABLED`; keep the two settings consistent for a disabled installation.

### Demo tenant login

The standalone login screen is shown before login, including on bookmarked business routes.
Selecting a Tenant obtains a candidate demo token and loads only its Stores into the second dropdown.
Changing Tenant clears the Store selection, cancels its old discovery client and ignores late candidate
tokens. The candidate session is activated and stored only after selecting a valid Store and submitting
Sign in; no business requests run before this. Login opens Vehicles for the selected Store. The seed creates the RentalSofia Tenant with Discordia and Sandbox Stores.
Core issues an HMAC-SHA256 token containing Tenant ID and an eight-hour expiry. Both subgraphs
verify it per request and reject missing/invalid/expired sessions as UNAUTHENTICATED. Gateway
forwards Authorization; tenantId never comes from a business input or x-tenant-id header.

Core, Fleet and Karma Client use the same DEMO_AUTH_SECRET (at least 32 characters). Their environment
examples show the local-only default; outside production it is used when no valid secret is set.
DEMO_AUTH_ENABLED=false disables tenant discovery, demoLogin and demo sessions. In NODE_ENV=production
demo auth is disabled unless explicitly enabled and a valid secret is configured. The flag is
for deliberate demonstration deployments only; it does not make this login production-ready.

Angular stores the session in tab-local sessionStorage under holita.admin.demo-session, restores
unexpired sessions and the last selected Store on reload and clears them on logout/expiry.
The language root redirects signed-in sessions to Vehicles for that Store (or the first available
Store if the saved selection no longer exists). There is no Store list page; the application header
retains the Store switcher. Saved Store IDs are checked against current tenant discovery. Denied storage leaves a memory-only
session. Each discovery/business client captures its token and owns its cache. Logout honors
unsaved-form navigation guards. Retired reads stop; submitted writes may finish against their
captured session, without updating another tenant's UI. No server-side revocation exists.

This login has no user verification, passwords, membership checks, roles, login throttling or
audit trail: anyone can select any tenant. Before production, replace public demoLogin/Tenant
discovery with real identity and tenant membership authorization, use secure HttpOnly session
cookies or an appropriate identity-provider flow, and add revocation and required permissions.
The database has mandatory tenant columns, scoped repositories and same-tenant composite keys;
it does not use PostgreSQL RLS. Owning-role/direct SQL access is not tenant-isolated.

### Angular Fleet Vehicles

Routes are `/:language/:storeId/fleet/vehicles`, `/new` and `/:recordId/edit`.
Previous `/reference/vehicles` and `/reference/devices` URLs redirect to `/fleet`, retaining
editor paths, query parameters and fragments. The backend service, subgraph and GraphQL contracts use Fleet names.
Fields are required License Plate (32 characters) and optional multiline Notes (2000 characters).
Blank Notes clear to null. License Plate is not unique. Lists offer URL-backed search/sort/paging,
confirmed single/page-local sequential deletion, partial result feedback and failed-row retry.
Deleting an assigned Vehicle fails without deleting its Devices.

### Angular Fleet Devices

Routes mirror Vehicles under `/fleet/devices`. IMEI is a required string of exactly 15 digits,
unique within a Tenant/Store; leading zeros are preserved. Truck is a required same-tenant/same-store Vehicle selected
through a remote search/paging dialog. Several Devices may share a Truck. Create/update validates
assignment scope, and the database protects it with a composite foreign key.

Both modules use typed Reactive Forms, dirty guards, retained failed drafts and focused field errors.
Clients/caches belong to mounted session/Store/language views. Navigation cancels reads and stops unsent
batch deletes; submitted writes finish in their captured scope without obsolete UI callbacks.

## Admin translations

Bundled Bulgarian/English catalogs supply shell, forms, confirmations and startup text.
Document language follows the route. Apollo clients capture `Accept-Language`; submitted
writes keep their initiating session/Store/language. Record content/backend messages display as received.

## GraphQL usage

Regenerate and restart after SDL/operation changes. Discover tenants through Gateway with `{ tenants { id name } }`, call `demoLogin(tenantId: "01000000-0000-4000-8000-000000000001") { token tenant { id name } }`, then send the returned token as `Authorization: Bearer <token>` for `{ stores { id name } }` and every business request. Business requests require `x-store-id`; the seeded Discordia Store is
`10000000-0000-4000-8000-000000000001`. For example:

```graphql
query VehiclesWithStores {
  fleetVehicles(offset: 0, limit: 20) {
    items {
      id
      licensePlate
      notes
      store {
        id
        name
      }
    }
    total
  }
}
```

Mutations are create/update/delete FleetVehicle and FleetDevice. Inputs never accept tenantId or storeId. [Architecture](architecture.md#graphql-contracts-and-context) describes
validation, federation and error semantics. Inspect GraphQL errors even on HTTP 200 and
preserve the response request ID when reporting failures. Store scope is not authorization.

## Karma Client

The independent Karma Client backend listens on loopback port 11014 and starts with `npm run dev`.
Use `npm run dev:karma-client` to start it alone. Copy `apps/karma-client/.env.example` to the ignored
`apps/karma-client/.env`, then set `KARMA_USER` and `KARMA_PASSWORD` for the shared account.
`KARMA_API_URL` defaults to `https://karma.online/apiv2/`. URLs must have HTTP(S) schemes and
no embedded credentials, query or fragment. Redirects are rejected. Missing/invalid connection
configuration leaves health usable and returns a sanitized error for the cars query.

Match Core's `DEMO_AUTH_SECRET` and `DEMO_AUTH_ENABLED` settings; this uses the same development-only
signed session protocol as Fleet. Gateway's optional `KARMA_CLIENT_GRAPHQL_URL` defaults to
`http://127.0.0.1:11014/graphql`. Regenerate contracts and restart after SDL changes.

After signing in, open **Karma Client → Trucks** (Bulgarian: **Камиони**) or visit
`/en/karma-client/cars` or `/bg/karma-client/cars`. Every authenticated Tenant/Store sees all
cars returned by the configured account. The list has no Store filter and is independent
of `fleetEnabled`. The table loads on entry and with Refresh, retaining the previous list
if refresh fails. It has no editing, automatic polling, persistence or Fleet synchronization.

Through Gateway, send the signed session in `Authorization: Bearer <token>` and request:

```graphql
query {
  karmaCars {
    id
    carNumber
    deviceId
    projectId
    carType
    carYear
    carColor
  }
}
```

No Store header is needed. The upstream account password and Karma session remain server-side.
