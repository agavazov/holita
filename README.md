# holita

holita is a strict TypeScript npm-workspaces repository with Nx tasks and five host
applications: Angular admin, native Apollo Router gateway and NestJS core, fleet and karma-client services.
The admin uses Sakai with holita branding, PrimeNG and Bulgarian/English catalogs.
Its modules are Vehicles, Devices and the shared Karma truck data and reference views. Core provides Store discovery; Gateway
exposes their schema-first federated GraphQL API. PostgreSQL is the only container.

Documentation separates [Discocan fleet telemetry](docs/discocan/README.md) from
[Ecommerce online stores](docs/ecommerce/README.md). Fleet and the current Vehicles/Devices
admin belong to Discocan; the Core Store foundation is documented under Ecommerce.
Discocan's current Stores will later become Branches, while Ecommerce keeps Stores for online
shops. Current code, contracts and persistence still use Store terminology.

## Run locally

Use Ubuntu/WSL with Node.js 24.15+ and npm 11. The pinned package manager is npm 11.19.0.

```bash
nvm use
npm ci
npm run router:install
npm run db:up
npm run db:setup
npm run db:migrate
npm run db:seed
npm run dev
```

On Ubuntu/WSL, run `npm run kill` in another terminal to stop the applications and their
watchers. PostgreSQL remains running; `npm run db:down` stops it separately.

If needed, run `nvm install` before `nvm use`. Open [Angular admin](http://127.0.0.1:11000).
Choose RentalSofia and a Store on the standalone demo login screen to open Vehicles. There is no Store list landing page; the header selector switches Stores after login. Switching Stores preserves the current Vehicles/Devices
section and resets the list query. Routes and list filters survive reloads and language changes.
Each mounted workspace owns its Apollo client/cache. Submitted writes settle in their original
Store; navigation cancels obsolete reads and callbacks.

Vehicles has required License Plate and optional multiline Notes. Devices has a required
15-digit IMEI unique within a Store and a mandatory same-tenant/same-store Vehicle, labeled Truck in the
editor. Multiple Devices can share a Vehicle; assigned Vehicles cannot be deleted.
Both Fleet modules provide search, sorting, paging, typed create/edit forms, dirty-form guards,
confirmed single/page-local sequential deletion and failed-row retry.

Karma Client → Users/Roles provides read-only account search, local paging and full user
details. Role descriptions and numeric flags are shown as source values.
Karma Client → Trucks lists all cars from one configured Karma account for every signed-in
Tenant/Store at `/bg/karma-client/cars` or `/en/karma-client/cars`. Configure the ignored
`apps/karma-client/.env` using its [environment example](apps/karma-client/.env.example).
Click a registration number to open read-only truck details; these pages support Refresh. Open eData from truck details for the latest 50 messages,
25/50/100 pagination, optional UTC/parameter-ID filters and complete message detail.
Open Location from truck details to inspect the last-known message and coordinates; valid
coordinates provide a map link in a new tab. Projects, Time zones and API information have
separate Karma menu entries. Reference lists support search and 25/50/100 pagination
(default 50); truck list/details show reference names beside their original IDs.
Trips and Events open separate truck histories with latest-50 pagination, optional date
filters and complete row details; Events also supports original event-code filters.
Driving profile shows nine category scores/weights for a default seven-day period, with
editable bounds. Trip/profile filters use API wall-clock values with an unspecified
provider timezone; metrics and event codes retain their original values.
Karma has no persistence or Fleet synchronization.
Karma is independent of the Store selector and `fleetEnabled`. See
[Karma configuration](docs/discocan/development.md#karma-client).

The shell supports keyboard/mobile navigation and persisted light/dark themes. The startup
`fleetEnabled` flag gates both business modules; Store discovery stays available.
The ignored [Sakai source](docs/development.md#sakai-source-reference) supplies the visual reference.

Gateway, Core, Fleet and Karma Client listen on loopback ports 11010, 11011, 11013 and 11014; PostgreSQL uses 11084. `dev` waits for PostgreSQL health before starting the five applications. Ctrl+C stops
the native Router and Node application group. `npm run db:down` stops PostgreSQL and preserves its volume. Setup, migrations
and seeding are explicit commands. The seed inserts RentalSofia, Discordia and Sandbox Stores, two sample Vehicles and one Device without replacing existing records.

Use [Gateway GraphQL](http://127.0.0.1:11010/graphql). `{ tenants { id name } }` is public for demo login. Sign in through `demoLogin` and send its token as `Authorization: Bearer <token>` to discover Stores. Store discovery needs no Store header. Fleet business operations require `x-store-id`, for example the seeded Discordia Store
`10000000-0000-4000-8000-000000000001`. The demo login has no passwords or tenant membership checks and must be replaced before production. Tenant identity is verified from the signed session; business records are scoped by Tenant and Store. See [demo session configuration and limitations](docs/discocan/development.md#demo-tenant-login).
Router exposes `/health` on its separate loopback port 11016; the subgraphs expose `/health`
on their normal ports. Health is independent of database/downstream availability.

To start one application, use `dev:admin`, `dev:gateway`, `dev:core`, `dev:fleet` or `dev:karma-client`.
`npm run dev` starts the official Apollo Router on 11010; Angular proxies `/graphql` to it.
Install the pinned binary once with `npm run router:install` before development, builds or
Gateway/browser checks. Router reads exported process variables, not `apps/gateway/.env`;
use `ROUTER_PORT` instead of `PORT`. There is no Node Gateway runtime or runtime selector.
See [Router configuration](docs/development.md#apollo-router) for health, environment and error behavior.
After SDL/operation changes run `npm run codegen`, `npm run schema:check` and restart the group.
Generated clients/types are ignored and must not be edited.

## Check a change

```bash
npm run lint
npm run typecheck
npm run build
npm run schema:check
npm run test:fleet -- vehicles.service.spec.ts devices.service.spec.ts --skip-nx-cache
npm run test:admin -- --include="app/features/fleet/vehicles/*.spec.ts" --include="app/features/fleet/devices/*.spec.ts" --skip-nx-cache
```

Use [focused validation](docs/testing.md) for dedicated database and browser checks, and
[development](docs/development.md) for configuration. Full regression requires an explicit
user/reviewer request. Start documentation navigation at [docs/README.md](docs/README.md).
