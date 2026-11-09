# discocan

discocan is a strict TypeScript npm-workspaces repository with Nx tasks and five host
applications: Angular admin, native Apollo Router gateway and NestJS core, fleet and erm-server services.
The admin uses the discocan [design system](docs/admin-design-system.md) on PrimeNG and
Bulgarian/English catalogs.
Its modules are Fleet management and ERM device-server inspection and controlled settings. Core provides users, sessions and Branch discovery; Gateway
exposes their schema-first federated GraphQL API. PostgreSQL is the only container.

Documentation separates [Discocan fleet telemetry](docs/discocan/README.md) from
[Ecommerce online shops](docs/ecommerce/README.md). Fleet and the current Vehicles/Devices
admin belong to Discocan; the Core Branch foundation is documented under Ecommerce.
Branch is the shared organizational scope: a vehicle fleet in Discocan and an online shop in
Ecommerce. Code, contracts, persistence and the admin use Branch terminology.

Fleet also stores the [versioned Simple eData vendor catalog](docs/discocan/erm-resources/simple-edata-catalog/README.md).
Its EXE inspection, extraction, comparison and local import use direct commands,
independent of the admin and sample-data seed.

ERM Server receives raw StarLink device TCP traffic, mirrors it to Karma and records connections,
frames, decoded events and commands in its own database plus private JSON Lines captures. Its
Fleet-scoped subgraph supplies the admin's ERM Server pages. It runs independently of the
web/API applications; see [ERM Server setup](docs/discocan/development.md#erm-device-server).

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
Sign in with your email and password, then choose a fleet to open Dashboard. Provision the
first Tenant user with the [controlled setup command](docs/development.md#core-users-and-sessions).
Development builds also expose an explicit Development demo login: choose RentalSofia,
continue, then select a Branch. The topbar Branch menu switches fleets after login. Switching Branches preserves the current Fleet
section and resets the list query. Routes and list filters survive reloads and language changes.
Each mounted workspace owns its Apollo client/cache. Submitted writes settle in their original
Branch; navigation cancels obsolete reads and callbacks.

Vehicles uses the shared Storybook list and routed create/edit drawer with the full master-data
fields, telemetry state, whole-Branch KPIs and URL-backed AND filters. Row and selection
delete/deactivate actions submit one IDs-array operation; partial failures retain selected
records for retry and appear in the shared operation toast. See the
[Vehicles workflow](docs/discocan/development.md#fleet-operator-workflows).

The sidebar contains Dashboard, Dashboard (old), Vehicles, Devices, Drivers, Maintenance and
Settings. Dashboard is one truck map: every truck with its online state, activity and problem
marker, a searchable list, and for the selected truck accordion details plus its recorded trail
for 1 h, 6 h, 24 h or today, coloured against the Branch speed limit. The selected truck's trail
grows every 10 s and the fleet refreshes every 15 s. Street View in the map corner follows the
selected truck's last position in its driving direction; clicking the route shows that point. It can
be hidden, restored and opened full screen. On the other maps a vehicle's popup opens Street View.
Dashboard (old) groups Overview, Problems and Trips. Overview combines whole-Branch KPIs, a fleet
map and interactive charts; Vehicle Overview adds the recorded track. Problems distinguishes actionable alerts from
recorded device evidence and command outcomes. Vehicle details offer Overview, Trips, Problems,
Maintenance and Commands; Commands selects an installed Device. Devices open Overview,
Problems, Trips, Commands, SMS commands, Parameters and Technical details.
Devices have a required 15-digit IMEI that is globally unique (one physical unit belongs to one
Branch) and optional scoped Vehicle assignment;
unassigned Devices are stock. Multiple Devices may share a Vehicle. Editable lists use typed
route drawers, URL filters and captured clients; supported row/selection actions preserve
partial failures for retry. Readable command history shows queued, waiting and terminal outcomes
with technical evidence in a modal. SMS cards prepare texts for the selected Device's stored
SIM/password; sending occurs in the phone app. Unsupported hardware actions remain unavailable.
General settings saves Branch regional preferences and thresholds plus a separate Core Branch
rename; partial saves retain the actual persisted values. Read values use the saved display units
and time zone/date format, while editors keep explicitly labelled canonical entry units. See the
[General settings workflow](docs/discocan/development.md#fleet-operator-workflows).

The account menu opens Profile and password changes. Settings → Users manages Tenant-wide
users; every authenticated Tenant user has equal access. The bell shows the persisted Branch
notification feed, unread count and read actions, with See all opening the filterable feed.
Notifications cover alert transitions, recorded device evidence and terminal command outcomes;
General settings controls retention (seven days by default). Delivery is in-app.

For richer local Fleet data, run `npm run db:seed:fleet-demo` after setup/migrations and with Core
running. It inserts only missing synthetic Discordia records and preserves existing edits.
The [demo seed guide](docs/discocan/development.md#fleet-demo-data) explains its fixed anchor and guards.

The shell supports keyboard/mobile navigation, a persisted sidebar rail and persisted light/dark
themes. The startup `fleetEnabled` flag gates both business modules; Branch discovery stays available.
The [admin design system](docs/admin-design-system.md) describes the theme, shell and patterns.
To start it separately, `npm run storybook:admin` serves the [admin Storybook](docs/development.md#admin-storybook) at
`http://127.0.0.1:11001` with synthetic data and no backend. Storybook is a development and
review tool; it has no automated tests.

Gateway, Core and Fleet listen on loopback ports 11010, 11011 and 11013; PostgreSQL uses 11084. `dev` waits for PostgreSQL health and generates admin GraphQL artifacts once before starting the four web/API applications and Storybook. Ctrl+C stops
the native Router, Node applications and Storybook together. `npm run db:down` stops PostgreSQL and preserves its volume. Setup, migrations
and seeding are explicit commands. The seed inserts RentalSofia, Discordia and Sandbox Branches, two sample Vehicles and one Device without replacing existing records.

Use [Gateway GraphQL](http://127.0.0.1:11010/graphql). Sign in through `signIn(email, password)`
and send its token as `Authorization: Bearer <token>` to discover Branches. Branch discovery
needs no Branch header. Fleet business operations require `x-branch-id`, for example the seeded Discordia Branch
`10000000-0000-4000-8000-000000000001`. Tenant identity is verified from the session;
business records are scoped by Tenant and Branch. `{ tenants { id name } }` and `demoLogin`
remain development-only paths with no password or membership checks. See
[user sessions and demo limitations](docs/discocan/development.md#user-sessions).
Router exposes `/health` on its separate loopback port 11016; the subgraphs expose `/health`
on their normal ports. Health is independent of database/downstream availability.

To start one application, use `dev:admin`, `dev:gateway`, `dev:core`, `dev:fleet`
or `dev:erm-server`. ERM Server defaults to HTTP health on loopback 11015 and device TCP on
all interfaces at 11500. It is outside `npm run dev` and `npm run kill`; run its compiled output
as an independent service to retain device connections during web/API restarts.
`npm run dev` starts the official Apollo Router on 11010; Angular proxies `/graphql` to it.
Install the pinned binary once with `npm run router:install` before development, builds or
Gateway/browser checks. Router reads exported process variables, not `apps/gateway/.env`;
use `ROUTER_PORT` instead of `PORT`. There is no Node Gateway runtime or runtime selector.
See [Router configuration](docs/development.md#apollo-router) for health, environment and error behavior.
After SDL/operation changes run `npm run codegen` and `npm run schema:check`, then restart Router
and the affected web/API services. Keep the ERM gateway running for API-only changes. The
independent `ERM_ROLE=recovery` listener uses TCP 11510; see the
[operator guide](docs/discocan/development.md#moving-a-unit-between-karma-and-discocan).
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
