# holita

holita is a strict TypeScript npm-workspaces repository with Nx tasks and four host
applications: Angular admin and NestJS gateway, core and fleet services.
The admin uses Sakai with holita branding, PrimeNG and Bulgarian/English catalogs.
Its business modules are Vehicles and Devices. Core provides Store discovery; Gateway
exposes their schema-first federated GraphQL API. PostgreSQL is the only container.

## Run locally

Use Ubuntu/WSL with Node.js 24.15+ and npm 11. The pinned package manager is npm 11.19.0.

```bash
nvm use
npm ci
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
Both modules provide search, sorting, paging, typed create/edit forms, dirty-form guards,
confirmed single/page-local sequential deletion and failed-row retry.

The shell supports keyboard/mobile navigation and persisted light/dark themes. The startup
`fleetEnabled` flag gates both business modules; Store discovery stays available.
The ignored [Sakai source](docs/development.md#sakai-source-reference) supplies the visual reference.

Gateway, Core and Fleet listen on loopback ports 11010, 11011 and 11013; PostgreSQL uses 11084. `dev` waits for PostgreSQL health before starting the four applications. Ctrl+C stops
the Node group. `npm run db:down` stops PostgreSQL and preserves its volume. Setup, migrations
and seeding are explicit commands. The seed inserts RentalSofia, Discordia and Sandbox Stores, two sample Vehicles and one Device without replacing existing records.

Use [Gateway GraphQL](http://127.0.0.1:11010/graphql). `{ tenants { id name } }` is public for demo login. Sign in through `demoLogin` and send its token as `Authorization: Bearer <token>` to discover Stores. Store discovery needs no Store header. Business operations require `x-store-id`, for example the seeded Discordia Store
`10000000-0000-4000-8000-000000000001`. The demo login has no passwords or tenant membership checks and must be replaced before production. Tenant identity is verified from the signed session; business records are scoped by Tenant and Store. See [demo session configuration and limitations](docs/development.md#demo-tenant-login).
Every backend exposes `/health`, independently of database/downstream availability.

To start one application, use `dev:admin`, `dev:gateway`, `dev:core` or `dev:fleet`.
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
