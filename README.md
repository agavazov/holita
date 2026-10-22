# holita

holita is a strict TypeScript npm-workspaces repository with Nx tasks and five host
applications: Angular admin, native Apollo Router gateway and NestJS core, fleet and karma-client services.
The admin uses the holita [design system](docs/admin-design-system.md) on PrimeNG and
Bulgarian/English catalogs.
Its modules are Vehicles, Devices and the shared Karma truck data and reference views. Core provides Branch discovery; Gateway
exposes their schema-first federated GraphQL API. PostgreSQL is the only container.

Documentation separates [Discocan fleet telemetry](docs/discocan/README.md) from
[Ecommerce online shops](docs/ecommerce/README.md). Fleet and the current Vehicles/Devices
admin belong to Discocan; the Core Branch foundation is documented under Ecommerce.
Branch is the shared organizational scope: a vehicle fleet in Discocan and an online shop in
Ecommerce. Code, contracts, persistence and the admin use Branch terminology.

Fleet also stores the [versioned Simple eData vendor catalog](docs/discocan/erm-resources/simple-edata-catalog/README.md).
Its EXE inspection, extraction, comparison and local import use direct commands,
independent of the admin and sample-data seed.

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

`npm run dev` also starts [admin Storybook](http://127.0.0.1:11001). On Ubuntu/WSL, run
`npm run kill` in another terminal to stop the applications, Storybook in the dev group and
their watchers. PostgreSQL remains running; `npm run db:down` stops it separately.

If needed, run `nvm install` before `nvm use`. Open [Angular admin](http://127.0.0.1:11000).
Choose RentalSofia and a Branch on the standalone demo login screen to open Overview. There is no Branch list landing page; the topbar Branch menu switches Branches after login. Switching Branches preserves the current Fleet
section and resets the list query. Routes and list filters survive reloads and language changes.
Each mounted workspace owns its Apollo client/cache. Submitted writes settle in their original
Branch; navigation cancels obsolete reads and callbacks.

Vehicles uses the shared Storybook list and routed create/edit drawer with the full master-data
fields, telemetry state, whole-Branch KPIs and URL-backed AND filters. Row and selection
delete/deactivate actions submit one IDs-array operation; partial failures retain selected
records for retry and appear in the shared operation toast. See the
[Vehicles workflow](docs/discocan/development.md#angular-fleet-vehicles).

The other live Fleet screens share their Storybook views: Overview, Alerts, Trip log,
Drivers/scorecards, Maintenance, Devices, Vehicle groups, General settings and Vehicle profile/manual odometer.
Devices have a required 15-digit IMEI unique per Branch and optional scoped Vehicle assignment;
unassigned Devices are stock. Multiple Devices may share a Vehicle. Editable lists use typed
route drawers, URL filters and captured clients; supported row/selection actions preserve
partial failures for retry. Restart and notification delivery are clearly labelled Demo/unavailable.
General settings saves Branch regional preferences and thresholds plus a separate Core Branch
rename; partial saves retain the actual persisted values. Read values use the saved display units
and time zone, while editors keep explicitly labelled canonical entry units. See the
[General settings workflow](docs/discocan/development.md#angular-fleet-general-settings).

For richer local Fleet data, run `npm run db:seed:fleet-demo` after setup/migrations and with Core
running. It inserts only missing synthetic Discordia records and preserves existing edits.
The [demo seed guide](docs/discocan/development.md#fleet-demo-data) explains its fixed anchor and guards.

Karma Client → Users/Roles provides read-only account search, local paging and full user
details. Role descriptions and numeric flags are shown as source values.
Karma Client → Trucks lists all cars from one configured Karma account for every signed-in
Tenant/Branch at `/bg/karma-client/cars` or `/en/karma-client/cars`. Configure the ignored
`apps/karma-client/.env` using the Karma Client and shared demo entries in the
[single root environment reference](.env.example).
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
Karma is independent of the Branch menu and `fleetEnabled`. See
[Karma configuration](docs/discocan/development.md#karma-client).

The shell supports keyboard/mobile navigation, a persisted sidebar rail and persisted light/dark
themes. The startup `fleetEnabled` flag gates both business modules; Branch discovery stays available.
The [admin design system](docs/admin-design-system.md) describes the theme, shell and patterns.
To start it separately, `npm run storybook:admin` serves the [admin Storybook](docs/development.md#admin-storybook) at
`http://127.0.0.1:11001` with synthetic data and no backend. Storybook is a development and
review tool; it has no automated tests.

Gateway, Core, Fleet and Karma Client listen on loopback ports 11010, 11011, 11013 and 11014; PostgreSQL uses 11084. `dev` waits for PostgreSQL health and generates admin GraphQL artifacts once before starting the five applications and Storybook. Ctrl+C stops
the native Router, Node applications and Storybook together. `npm run db:down` stops PostgreSQL and preserves its volume. Setup, migrations
and seeding are explicit commands. The seed inserts RentalSofia, Discordia and Sandbox Branches, two sample Vehicles and one Device without replacing existing records.

Use [Gateway GraphQL](http://127.0.0.1:11010/graphql). `{ tenants { id name } }` is public for demo login. Sign in through `demoLogin` and send its token as `Authorization: Bearer <token>` to discover Branches. Branch discovery needs no Branch header. Fleet business operations require `x-branch-id`, for example the seeded Discordia Branch
`10000000-0000-4000-8000-000000000001`. The demo login has no passwords or tenant membership checks and must be replaced before production. Tenant identity is verified from the signed session; business records are scoped by Tenant and Branch. See [demo session configuration and limitations](docs/discocan/development.md#demo-tenant-login).
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
npm run db:up
npm run check
```

Run `npm run check` once, when the change is ready. It builds, tests and lints only what the change
affects, using the Nx and ESLint caches. [Testing](docs/testing.md) describes it and the
database, federation and browser checks, and [development](docs/development.md) covers
configuration. Full regression requires an explicit user/reviewer request. Start documentation navigation at [docs/README.md](docs/README.md).
Pending work and plans belong in the [project backlog](docs/todo/README.md). Machine-specific
instructions and credential locations belong in the ignored `AGENTS.local.md`; see
[local contributor setup](docs/development.md#local-contributor-instructions-and-credentials).
