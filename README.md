# holita

holita is a strict TypeScript npm-workspaces repository with Nx tasks and four host
applications: Angular admin and NestJS gateway, core and reference services.
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

If needed, run `nvm install` before `nvm use`. Open [Angular admin](http://127.0.0.1:11000).
Choose a Store to open Vehicles. Switching Stores preserves the current Vehicles/Devices
section and resets the list query. Routes and list filters survive reloads and language changes.
Each mounted workspace owns its Apollo client/cache. Submitted writes settle in their original
Store; navigation cancels obsolete reads and callbacks.

Vehicles has required License Plate and optional multiline Notes. Devices has a required
15-digit IMEI unique within a Store and a mandatory same-store Vehicle, labeled Truck in the
editor. Multiple Devices can share a Vehicle; assigned Vehicles cannot be deleted.
Both modules provide search, sorting, paging, typed create/edit forms, dirty-form guards,
confirmed single/page-local sequential deletion and failed-row retry.

The shell supports keyboard/mobile navigation and persisted light/dark themes. The startup
`referenceEnabled` flag gates both business modules; Store discovery stays available.
The ignored [Sakai source](docs/development.md#sakai-source-reference) supplies the visual reference.

Gateway, Core and Reference listen on loopback ports 11010, 11011 and 11013; PostgreSQL uses 11084. `dev` waits for PostgreSQL health before starting the four applications. Ctrl+C stops
the Node group. `npm run db:down` stops PostgreSQL and preserves its volume. Setup, migrations
and seeding are explicit commands. The seed inserts missing Stores; Vehicles/Devices start empty.

Use [Gateway GraphQL](http://127.0.0.1:11010/graphql). `{ stores { id name } }` needs no Store
header. Business operations require `x-store-id`, for example the seeded Sofia Store
`10000000-0000-4000-8000-000000000001`. This local foundation has no authentication or authorization.
Every backend exposes `/health`, independently of database/downstream availability.

To start one application, use `dev:admin`, `dev:gateway`, `dev:core` or `dev:reference`.
After SDL/operation changes run `npm run codegen`, `npm run schema:check` and restart the group.
Generated clients/types are ignored and must not be edited.

## Check a change

```bash
npm run lint
npm run typecheck
npm run build
npm run schema:check
npm run test:reference -- vehicles.service.spec.ts devices.service.spec.ts --skip-nx-cache
npm run test:admin -- --include="app/features/reference/vehicles/*.spec.ts" --include="app/features/reference/devices/*.spec.ts" --skip-nx-cache
```

Use [focused validation](docs/testing.md) for dedicated database and browser checks, and
[development](docs/development.md) for configuration. Full regression requires an explicit
user/reviewer request. Start documentation navigation at [docs/README.md](docs/README.md).
