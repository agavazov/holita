# Local development

## Prerequisites and installation

Use Ubuntu/WSL, Node.js 24.15+ and npm 11. The pinned package manager is npm 11.19.0.

```bash
nvm use
npm ci
npm run router:install
```

Run `nvm install` first if needed. Non-interactive shells may need to source `$HOME/.nvm/nvm.sh`
before `nvm use`. Native Windows execution is outside the verified setup.

## Local contributor instructions and credentials

Keep machine-specific instructions in the optional, Git-ignored root `AGENTS.local.md`.
Agents read it alongside [the shared guide](../AGENTS.md); a missing local file does not
block work. Shared contributor rules remain in `AGENTS.md`.

Shared local credentials live in the common services-level `.credentials/` directory,
outside project repositories. This checkout also uses a private project-local `.credentials/`
directory, ignored by Git, Nx, ESLint and Prettier and excluded from repository-wide searches
and scans. Record exact locations and relevant connection references in `AGENTS.local.md`.
Read the selected store's inventory and the required service/connection README before use.
Keep separate service/account/environment folders, descriptive
value filenames and README files without secrets; use directory mode `0700` and credential
file mode `0600`. Pass values through process environments, stdin or supported client stores.
Ignored application `.env` files remain runtime configuration. Never put real credentials
in environment examples, documentation, agent instructions, command arguments or logs.

## Commands

| Command                       | Behavior                                                                 |
| ----------------------------- | ------------------------------------------------------------------------ |
| npm run dev                   | Wait for PostgreSQL, prepare admin GraphQL, start all apps and Storybook |
| npm run kill                  | Stop this checkout's application processes and watchers on Ubuntu/WSL    |
| npm run dev:admin             | Angular watcher                                                          |
| npm run storybook:admin       | Admin Storybook with synthetic data on port 11001                        |
| npm run build:storybook:admin | Static admin Storybook in the ignored `apps/admin/storybook-static`      |
| npm run dev:gateway           | Native Router after Nx supergraph generation                             |
| npm run dev:core              | Core watcher                                                             |
| npm run dev:fleet             | Fleet watcher                                                            |
| npm run dev:karma-client      | Karma Client watcher                                                     |
| npm run projects              | List five Nx applications                                                |
| npm run lint                  | Lint source/tooling and application boundaries                           |
| npm run typecheck             | Check tools and all applications                                         |
| npm run build                 | Build all applications                                                   |
| npm run format:check          | Check formatting                                                         |
| npm run codegen               | Generate application GraphQL contracts                                   |
| npm run schema:check          | Compose SDL and validate operations offline                              |

ESLint requires braces for every conditional and loop body (`curly: ['error', 'all']`),
including single-statement bodies in application code, tests, tools and Storybook stories.
The rule is configured after `eslint-config-prettier` so that it remains enabled.

Backend output is `apps/NAME/dist`; `npm run start:prod --workspace @holita/core`
(or fleet/karma-client) runs the compiled app. Gateway `build` generates the supergraph and
validates the installed native Router configuration. `npm run start:prod --workspace @holita/gateway`
starts that binary using the generated supergraph; no Node bundle or Rust compilation is involved. `dev` does not migrate or seed databases.
The group generates admin GraphQL artifacts once before starting Angular and Storybook in
parallel; their standalone commands keep their own generation step. Ctrl+C stops the process
group, including Storybook; `db:down` stops PostgreSQL separately and preserves the volume.
Use `npm run kill` from another terminal when application processes remain running. It stops
the dev group (including its Storybook), individual Angular/Nest watchers and compiled backend processes from this checkout,
including the native Router, the concurrently group and their child workers. It sends
SIGTERM, then SIGKILL to survivors after two seconds.
PostgreSQL and processes from other checkouts remain running. Running it again is harmless.

## Ports and environment

| Application     | Default loopback port |
| --------------- | --------------------- |
| Angular admin   | 11000                 |
| Admin Storybook | 11001                 |
| Gateway GraphQL | 11010                 |
| Gateway health  | 11016                 |
| Core            | 11011                 |
| Fleet           | 11013                 |
| Karma Client    | 11014                 |
| PostgreSQL      | 11084                 |

Visual previews use 11000–11009; the admin Storybook uses 11001. The single root
[`.env.example`](../.env.example) describes all variables, their consumers, safe examples,
types and sensitivity using [`@env-spec` style annotations](https://varlock.dev/reference/data-types/).
These comments document configuration; dotenv and Compose do not validate them, and no
schema validator is installed. Keep this contract in `.env.example` when changing variables.
Defaults work without environment files; Karma queries require an upstream account.
Existing process variables take precedence. Subgraph PORT must be an integer from 1 to 65535.
Node apps and Prisma read their own workspace `.env`; database provisioning reads root/Core/Fleet.
Router reads exported variables only: migrate any Gateway `.env` overrides into the shell
environment and use `ROUTER_PORT` instead of `PORT`. The admin proxy reads the same `ROUTER_PORT`.

Copy only the relevant entries from the reference into the consuming process's ignored
runtime file, preserving existing settings:

| Consumer                 | Runtime configuration                                                                                               |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| Compose and provisioning | Root `.env`: `POSTGRES_PORT`, `POSTGRES_PASSWORD`                                                                   |
| Core and Prisma          | `apps/core/.env`: Core database URLs and shared demo settings                                                       |
| Fleet and Prisma         | `apps/fleet/.env`: Fleet database URLs, shared demo settings, `FLEET_ENABLED`, `CORE_GRAPHQL_URL` and admin origins |
| Karma Client             | `apps/karma-client/.env`: `KARMA_API_URL`, `KARMA_USER`, `KARMA_PASSWORD` and shared demo settings                  |
| Router and Angular proxy | Export Router variables in the shell that launches npm; proxy reads `ROUTER_PORT`                                   |

An optional `PORT` override belongs only to an individual Node application; omit it to
keep that application's default. Exporting one `PORT` for the development group gives
all subgraphs the same listener port. The reference is scoped by consumer, so copy the
needed entries rather than loading the entire file into a process.

Gateway uses `CORE_GRAPHQL_URL`, `FLEET_GRAPHQL_URL`, `KARMA_CLIENT_GRAPHQL_URL` and `ADMIN_ORIGIN`.
Fleet uses `CORE_GRAPHQL_URL`, `FLEET_ENABLED` and `ADMIN_ORIGINS`, a comma-separated
exact origin allowlist with `ADMIN_ORIGIN` as the single-origin fallback. Defaults allow the
Angular loopback origin. Database URLs belong only to Core/Fleet. Karma Client has application-local account settings described in
[Karma Client configuration](discocan/development.md#karma-client). No upload/storage
configuration is required.

Background eData parameter operations additionally use `FLEET_DEVICE_OPERATIONS_ENABLED` and
`FLEET_KARMA_INTERNAL_URL` in Fleet, and the same private `KARMA_INTERNAL_TOKEN` (at least
32 characters) in Fleet and Karma Client. The worker is disabled by default; Fleet's separate
`FLEET_DEVICE_CONFIGURATION_WRITES_ENABLED` also defaults to `false` and requires the worker
to be enabled. Keep the token
in process environments or ignored runtime `.env` files, never admin configuration.
See [device configuration setup](discocan/development.md#background-device-configuration-reads).

The admin reads browser configuration from `apps/admin/public/config.json` and optional
Git-ignored `apps/admin/public/config.local.json`. Karma's optional `googleMapsEmbedApiKey`
belongs in that JSON configuration, not a Node environment variable; see
[Karma maps](discocan/development.md#karma-maps). Local configuration overrides the public
file and is excluded from production assets.

## Apollo Router

The Gateway workspace includes a standalone [Apollo Router 2.18.0](https://github.com/apollographql/router/releases/tag/v2.18.0)
configuration integrated with npm/Nx for Ubuntu/WSL on x86_64. Install the pinned Linux binary with `curl`, `tar`,
`sha256sum` and GNU coreutils available, then run it from the repository root:

```bash
npm run router:install
npm run router:check
npm run dev
```

The installer verifies the release archive's pinned SHA-256 before extraction and keeps
the binary and upstream license notices in ignored `apps/gateway/router/dist/`.
It requires no npm dependency, Rust toolchain, container, GraphOS account or API key.
`dev` waits for PostgreSQL and starts Router, Core, Fleet, Karma Client, Angular and Storybook
using concurrently. Angular keeps the public `/graphql` URL and uses `proxy.conf.mjs`,
targeting `ROUTER_PORT` (11010 by default). Stop any existing development group before starting
another because the applications share ports.
Ctrl+C stops the group; `npm run kill` also recognizes the native Router in this checkout.
Database migration/seeding still use the normal explicit setup commands.

For individual processes, use `dev:gateway` and `dev:admin`. Gateway's npm `dev` and
`start` scripts run the Nx `gateway:graphql-generate` target, then start Router with
anonymous telemetry disabled in the original npm process environment. Runtime scripts
are excluded from Nx target inference: Nx manages generation, builds and checks, while
Router startup preserves exported shell variables without Nx's dotenv loading or
unloading. Root and Gateway `.env` files therefore cannot change Router's ports or
downstream URLs independently of the Angular proxy. Keep Router overrides in the exported
shell environment for both development and `start:prod`.
It does not watch configuration/SDL changes; restart Router after changes.
`router:check` validates YAML with the installed binary. Installation is explicit, including
in CI; development and tests do not silently download or replace the executable.

The [Router configuration](../apps/gateway/router/router.yaml) reads exported process variables;
it does not load `apps/gateway/.env`. Defaults are:

| Variable                 | Default                        |
| ------------------------ | ------------------------------ |
| ROUTER_PORT              | 11010 (`/graphql` on loopback) |
| ROUTER_HEALTH_PORT       | 11016 (`/health` on loopback)  |
| CORE_GRAPHQL_URL         | http://127.0.0.1:11011/graphql |
| FLEET_GRAPHQL_URL        | http://127.0.0.1:11013/graphql |
| KARMA_CLIENT_GRAPHQL_URL | http://127.0.0.1:11014/graphql |
| ADMIN_ORIGIN             | http://127.0.0.1:11000         |

For example, `ROUTER_PORT=11017 npm run dev` changes Router's GraphQL listener and the Angular proxy together; health remains on 11016.
The configured origin can send GET/POST/OPTIONS with `authorization`, `content-type`,
`x-branch-id` and `x-request-id`. The three context headers are forwarded to all subgraphs.
Health returns `{"status":"UP"}` from the dedicated health port, independently of downstream health.

The [Rhai compatibility hook](../apps/gateway/router/compatibility.rhai)
applies after GraphQL parsing/schema validation, at the supergraph boundary:

- A single `x-request-id` matching `[A-Za-z0-9._:-]{1,100}` is preserved; missing, invalid
  or repeated values are replaced by a UUIDv4. Subgraphs, the response header and public
  error extensions receive the same request ID.
- Known public error codes/messages survive. Unexpected errors become `INTERNAL_SERVER_ERROR`
  with `Internal server error`. Extensions contain only `code`, `requestId` and, for
  `BAD_USER_INPUT`, sanitized `fieldErrors`. Only the first 30 entries are considered;
  paths start with an ASCII letter and contain ASCII letters/digits, and messages are
  at most 300 UTF-16 code units. Invalid variable values use HTTP 400 and `BAD_USER_INPUT`;
  compiler diagnostic wording and locations remain native to Router.
- Each subgraph request has a five-second timeout. Transport failures, malformed upstream
  responses and subgraph timeouts become `SERVICE_UNAVAILABLE` with
  `A required service is unavailable; try again later`. These execution errors use HTTP 200.
- Unexpected GraphQL errors log the request ID and a fixed error category, without copying
  subgraph messages, tokens or arbitrary extensions into the Rhai log.

Early parse/schema-validation failures intentionally use native Router HTTP 400 bodies:
syntax failures use `PARSING_ERROR`, and schema-validation failures use
`GRAPHQL_VALIDATION_FAILED`. They do not execute subgraph requests and have no application
request ID in their body/header. Their diagnostic wording, locations and error count follow
the pinned Router release. Business input validation remains separate
and retains the messages, `fieldErrors` and request IDs described above.
Rhai in the pinned Router cannot modify these early response bodies because they precede
the supergraph hook; its router-level hook has no response-body access. The official release
binary is used without a custom Rust build.

The HTTP/1 connection buffer is bounded to 16 KiB, rejecting oversized request headers
with native HTTP 431 before subgraph execution. CORS preflight succeeds with HTTP 200
with the configured allowed origin, methods and headers.

The admin transport handles these HTTP 400 responses using its normal fallback message and
locally generated request ID, even without a response ID. That local ID alone does not
establish correlation with Router logs for early failures. Native HTTP rejection behavior,
the default 30-second whole-request timeout and the separate health response are native Router behavior.
Federation and compiled-admin browser fixtures start Router by default on ephemeral ports.
There is no JavaScript Gateway fallback or runtime selector. The [Router checks](testing.md#router-contract-check)
assert the public contract directly over real subgraphs and isolated test databases.

## Domain development

- [Discocan development](discocan/development.md): telemetry admin, demo login, Vehicles/Devices and API usage.
- [Ecommerce Branches](ecommerce/branches.md): Branch discovery contracts and implementation.

## Angular presentation and agent tools

### Admin presentation

The [admin design system](admin-design-system.md) describes the implemented theme (`holitaPreset`
over standard Aura), global styles, shell, patterns and their Storybook review; the decision is
[ADR 0004](architecture/decisions/0004-admin-design-system.md). The root font size is the browser
default (16 px). Lato weights 400, 500, 600, 700 and 800, including Cyrillic glyphs, are served
from `apps/admin/public/fonts/lato`; no external font CDN is required. Font sources and licenses
are recorded in [the admin attribution](../apps/admin/THIRD_PARTY_NOTICES.md).

### Admin Storybook

Storybook renders the admin's real Angular components with deterministic synthetic data and no
backend. `npm run dev` includes Storybook; `npm run storybook:admin` starts it separately. Both
serve `http://127.0.0.1:11001` without opening a browser;
`npm run build:storybook:admin` writes the ignored `apps/admin/storybook-static`. Storybook starts
at "Start here", followed by Examples and Design System; the
[Storybook review](admin-design-system.md#storybook-review) lists what each title shows.
[Story tests](testing.md#storybook-story-tests) run every story with its play function and axe;
[visual review](testing.md#storybook-visual-review) captures selected stories from the static
build.

- The framework is `@storybook/angular-vite` on Vite and `@angular/build`, without webpack. It is a
  preview framework in Storybook 10. Configuration is in `apps/admin/.storybook`: `main.ts`
  (stories, the a11y and Vitest addons, telemetry disabled), `preview.ts` (decorator, toolbar
  globals, viewports, story order and the accessibility level) and `vitest.config.mts` (story
  tests). These builders do not inherit the application build's styles, so `src/styles.scss` and
  the `src/styles` SCSS path are repeated in the `storybook` and `build-storybook` targets of
  `apps/admin/angular.json` and in `storybookAngularVitest` in `vitest.config.mts`. Keep those
  styles and paths aligned with the `build` target. Vite's public directory, `apps/admin/public`,
  serves `/fonts` and `/config.local.json` to the interactive Storybook and the story tests.
  For the static build, `main.ts` sets `build.copyPublicDir: false` and uses `staticDirs` to copy
  only `public/fonts` to `/fonts`; the other public files are excluded.
- The Nx targets in `apps/admin/project.json` are `storybook` (continuous, uncached),
  `build-storybook` (cached, output `apps/admin/storybook-static`) and `test-storybook` (uncached,
  `vitest run --config .storybook/vitest.config.mts`); each first runs `graphql-generate`.
- Toolbar globals switch the theme (light/dark), brand and density; the application itself uses
  `appTheme`. A change re-bootstraps the story: the `holitaApplication` decorator in `preview.ts`
  rebuilds `storybookApplicationConfig(choice)` and keys a `STORY_GLOBALS` provider on brand,
  density and theme. Viewports are `desktop1440`, `desktop1024`, `tablet768` and `mobile375`.
  Stories start in English: `UI_LANGUAGE` is fixed to `en`, and fixtures and samples are English.
  The shell previews and the example pages list sample languages that change nothing; the routed
  Shell stories render the real `AdminWorkspace`, whose bg/en menu navigates to the other
  language's route and so switches the workspace texts.
- Stories are `*.stories.ts` files beside the components they render. Story-only support lives in
  `apps/admin/src/storybook`. `storybookApplicationConfig()` reuses the application's `appConfig`
  providers with `FixtureHttpBackend` as `HttpBackend`, an in-memory location, the story clock
  (`WALL_CLOCK`) and PrimeNG texts. Feature services, their Apollo clients, error mapping and
  request headers run unchanged.
- Render helpers: pattern stories wrap the component in the `onFrame` decorator (frame surface,
  gutter and content width). `routeAt(path)` with `StoryApp` opens a real application route under
  `/en/` with GraphQL answered by fixtures (the routed Design System/Shell stories).
  `exampleAt(path)` (`src/storybook/samples/example-app.ts`) renders `ExampleApp`, which replaces
  the router configuration with the example routes and shows the example pages inside
  `AdminShell` without GraphQL; `?scenario=` and `?drawer=` in the path open their states. The
  example pages feed the `features/fleet/*` views and drawers from
  `src/storybook/samples/fleet-samples.ts`, generated with fixed seeds relative to
  `2026-10-18T07:00:00.000Z`. Stories use seeded sample records; generator changes can alter the
  data used by play functions and visual captures.
  The standalone `Examples/Authentication/Login` mounts the real `Login` through the story-only
  `LoginPage`; its successful submission enters the existing sample Fleet with the selected
  Tenant and Branch, without activating a real session.
- GraphQL fixtures: a module registers an answer at load time with
  `graphqlFixture(GeneratedDocument, (variables) => result)` and must be imported by the story or
  by `story-config.ts`. Handlers read `FixtureVariables` (runtime-checked accessors and `branchId`
  from `x-branch-id`) and throw `fixtureError(code, message, fieldErrors?)` for a GraphQL error.
  `AdminBranches` (`session-fixtures.ts`) is registered globally. Login stories also register
  `AdminTenants` and `AdminDemoLogin` and override Branch discovery for their empty scenarios
  through `login-fixtures.ts`, restoring the shared Branch handler on cleanup. Unregistered
  operations answer with the GraphQL error `No Storybook fixture answers <Operation>.` Responses carry the request ID
  `fixture-<Operation>`. The backend sets `data-fixture-in-flight` and `data-fixture-activity` on
  `<html>` for the visual check. `src/storybook/graphql-fixtures.spec.ts` is an admin unit spec.
- `parameters.holita` (`StoryFixtures`, declared with `satisfies StoryFixtures`) is read at runtime
  by `readStoryFixtures`, which ignores unknown values:
  - `signedIn: false` clears the stored demo session; by default a story starts signed in as the
    synthetic tenant `Demo Logistics Ltd` on its first Branch, `Sofia Fleet`.
  - `fleetEnabled: false` sets the runtime `fleetEnabled` flag.
  - `now` is the ISO instant behind `WALL_CLOCK` (`AdminTopbar` uses it for relative notification
    times); the default is `2026-10-18T07:00:00.000Z`, and an invalid value falls back to it.
  - `scenario.latencyMs` delays every answered operation.
  - `scenario.failures` maps an operation name, or `<Operation>:<id>` for calls whose `id`
    variable matches (that key wins), to `network` (HTTP 503), `graphql` (an error without a
    code), `pending` (no answer), `not-found`, `conflict`, `unavailable`, `bad-input` (errors with
    `NOT_FOUND`, `CONFLICT`, `SERVICE_UNAVAILABLE` and `BAD_USER_INPUT`) or `network-after-first`
    (the first call answers, later calls get HTTP 503).
- Before every story the preview's `beforeEach` (`prepareStory`) resets the scenario and call
  counts, the clock, the stored session, the theme and the document language. Session and failure
  options affect only stories that call GraphQL, which are the routed Shell stories.
- PrimeNG drawers, dialogs and menus render into `document.body`, so play functions query
  `within(canvasElement.ownerDocument.body)` and choose menu items with `chooseMenuItem` from
  `src/storybook/interactions.ts`, which clicks the item's label as `p-menu` expects. Dialogs fade
  in, so visibility and focus assertions on them run inside `waitFor`; example stories wait for
  the routed page with `{ timeout: 10_000 }`.
- `tsconfig.app.json` excludes stories and `src/storybook`; `npm run typecheck` compiles them
  through `apps/admin/.storybook/tsconfig.json`, which excludes specs, and ESLint rejects Storybook
  or fixture imports from application code.
- PrimeUI license: the interactive Storybook and the story tests serve the Git-ignored
  `apps/admin/public/config.local.json` at `/config.local.json`, and `loadStoryLicense()` passes
  its `primeUiLicense` to the theme once per page. A missing file, a non-JSON answer or an invalid
  file means no key, whereas the application rejects an invalid file. The application `build`
  excludes `config.local.json` from its base assets; only its `development` configuration copies
  it. `ng serve` serves that development output from memory; `admin:build:development` writes it
  into `apps/admin/dist/browser` and the Nx cache, so never publish or share that output.
  The production `build` and `build-storybook` exclude the file even when it exists locally.
  Built stories, visual captures and compiled-app browser smokes therefore run without a key and
  show the "Invalid PrimeUI License" notice. The notice is accepted and is never hidden; story
  tests exclude it (`#p-license-host`) from axe.

### Angular agent tools

The repository includes the official
[Angular developer skill](../.agents/skills/angular-developer/SKILL.md) from
[angular/skills](https://github.com/angular/skills), revision
`eaf83d2c88fb5fa1449cf717792d32f1463dc1b9`. It is an unchanged upstream snapshot in
`.agents/skills/angular-developer`; Prettier excludes that directory. Update it deliberately
from the official source, keeping its referenced files together. Codex discovers repository
skills automatically; start a new turn, or restart Codex if the new skill does not appear.

[holita-admin-development](../.agents/skills/holita-admin-development/SKILL.md) adds only
Holita's application boundaries, generated contracts, lifecycle and check selection.
[holita-admin-design-system](../.agents/skills/holita-admin-design-system/SKILL.md) covers central
token, brand, density and pattern changes, new PrimeNG controls and screens built from the
patterns, with their stories and checks.

Install the official [PrimeNG plugin](https://primeng.dev/plugin) in the Codex user environment:

```bash
codex plugin marketplace add primefaces/primeui-plugins
codex plugin add primeng@primeui
codex plugin list --json
npx --yes @primeui/cli doctor --tool codex --library primeng --json
```

The plugin bundles seven focused skills and the read-only `@primeng/mcp` server. Its manifest
selects the PrimeNG 22 package range `>=22.0.0 <23.0.0`. Do not register that server again
through `codex mcp add` or project configuration. Start a new Codex session after installation
to load its tools; restart Codex if discovery has not refreshed. The plugin installation is
user-local, so another contributor must install it separately. No application dependency or
issued PrimeUI license key is needed to run the documentation server.

Use the plugin's router to select the smallest relevant workflow and current MCP metadata
before writing component APIs. `doctor` verifies the installed payload, server startup,
eight-tool contract, documentation retrieval and valid/invalid API handling. Host skill/MCP
discovery may be reported as unsupported separately from those passing runtime checks;
verify tool availability in the new session. These checks do not replace application tests.

The root Prettier configuration selects the Angular parser for `apps/admin/src/**/*.html`,
including suffixless component templates. To format or check only these templates:

```bash
npm exec -- prettier --write 'apps/admin/src/**/*.html'
npm exec -- prettier --check 'apps/admin/src/**/*.html'
```

## GraphQL and generation

SDL and named operation paths are explicit in `tools/graphql/contracts.mts`. Runtime Fleet
loads its common SDL followed by the Vehicle, Device, Driver, Vehicle group, Telemetry, Trip,
Event and Service task SDL in the same order; Gateway loads the generated static supergraph. No database or running
backend is required for codegen/schema validation. Generated outputs stay ignored.
Codegen maps `ID` to `string`; on the servers `DateTime` is a `string` input (validated by the
service) and a `Date` output, and the calendar `Date` scalar is a `YYYY-MM-DD` string. Admin
operations receive both as strings.

```bash
npm run codegen
npm run schema:check
```

Regenerate and restart after SDL/operation changes. Domain API examples are in
[Discocan development](discocan/development.md#graphql-usage) and
[Ecommerce Branches](ecommerce/branches.md#graphql-contracts).

## PostgreSQL and Prisma

Only PostgreSQL runs in Compose; migrations, seeds and test processes run on the host.

```bash
npm run db:up
npm run db:setup
npm run db:test:setup
npm run db:migrate
npm run db:seed
```

Provisioning creates/verifies four databases and matching roles, preserves existing data and
passwords, checks role privileges/ownership and revokes PUBLIC database access. The loopback
provisioning role is `holita_admin`; application URLs never use it.

| Service | Development database/role | Test database/role | Environment variables                       |
| ------- | ------------------------- | ------------------ | ------------------------------------------- |
| Core    | holita_core               | holita_core_test   | CORE_DATABASE_URL, CORE_TEST_DATABASE_URL   |
| Fleet   | holita_fleet              | holita_fleet_test  | FLEET_DATABASE_URL, FLEET_TEST_DATABASE_URL |

Roles cannot connect to another service's databases or the corresponding dev/test database.
The [root environment example](../.env.example) configures POSTGRES_PORT/POSTGRES_PASSWORD.
If overriding the port, update application/test URLs too. Setup accepts only expected identities
on 127.0.0.1 at that port. Examples do not replace credentials in existing installations.
Compose project `holita` uses `holita_postgres_data` mounted at `/var/lib/postgresql`.
`db:down` preserves the volume. Do not delete volumes or reset databases to repair setup.

Core/Fleet own their schemas, generated Prisma clients and reviewed SQL migrations. Core
retains its initial migration; Fleet retains its initial migration and adds the shared
eData reference catalog, the Branch rename, the master data (`20261018100000_fleet_master_data`:
Vehicle/Device columns, Driver, VehicleGroup) and the activity tables
(`20261018110000_fleet_activity`: VehicleStatusSample, Trip, FleetEvent, ServiceTask), durable
device reads (`20261021000000_device_configuration_reads`) and parameter change intent/phases
(`20261021100000_device_parameter_changes`) through
additive migrations. Branch and every
Fleet business table place tenantId immediately after id. Fleet foreign keys include
Tenant/Branch, and natural-key uniqueness includes Tenant/Branch. `db:migrate` deploys Core then Fleet; `db:generate` generates both ignored
clients. Initial migrations require empty databases; a previous migration history needs an
explicitly authorized database rebuild. `db:migrate` never resets databases. Subsequent schema
changes require new reviewed SQL migrations, not edits to applied history or db push.

Produce Fleet migration SQL from `apps/fleet` (the CLI needs its `prisma.config.ts`): copy the
committed schema outside the repository, edit `prisma/schema.prisma`, run `npm run db:validate`,
then `npx prisma migrate diff --from-schema "$PREV" --to-schema prisma/schema.prisma --script`.
Wrap the output in `BEGIN;`/`COMMIT;`, append the hand-written CHECK constraints Prisma cannot
express and review that it only adds objects. Applying the master data migration to an existing
database keeps every row: Vehicles receive status `ACTIVE` and Devices an empty option list
through column defaults; the activity migration only creates new enums, tables, indexes and
foreign keys. Regenerate clients/contracts (`npm run db:generate`, `npm run codegen`) and
restart after `npm run db:migrate`.
`db:seed` inserts RentalSofia, Discordia and Sandbox Branches, two Discordia Vehicles and one Device
with a leading-zero IMEI. Existing keys and edits are preserved. Core runs before Fleet; Fleet
fixtures belong to RentalSofia's Discordia Branch.

The [Simple eData catalog procedure](discocan/erm-resources/simple-edata-catalog/README.md)
uses direct commands for EXE inspection, extraction, comparison and local Fleet import.
It is separate from the sample-data seed and has no npm workflow registration.

## Troubleshooting

Use `nvm use` when node/npm are unavailable. Check Docker before `db:up`; setup and migration
are explicit prerequisites. Check application health endpoints and GraphQL errors separately.
A health response does not prove database readiness. Regenerate contracts and restart the group
when SDL/operations change. Check the selected Branch and Fleet startup/backend flags for
unavailable business screens. See [testing](testing.md) for guarded fixtures and cleanup.

## Branch database and API migration

Core and Fleet each include `20261017010000_rename_store_to_branch`. Core renames
the existing `Store` table to `Branch`; Fleet renames Vehicle/Device `storeId`
columns to `branchId`. These migrations preserve row IDs, timestamps, relations,
column positions and the previously applied migration history. Existing volumes
and data remain in place. Branch means an online shop in Ecommerce and a vehicle
fleet in Discocan.

Stop the local application group before applying these coordinated migrations.
Keep a database backup, run `npm run db:migrate`, regenerate clients/contracts
with `npm run db:generate` and `npm run codegen`, then restart with `npm run dev`.
The public API uses `Branch`, `branches`, `branch`, `branchId` and
`x-branch-id`; the former Store fields and header are unsupported. Fleet URLs
keep their language/UUID/resource structure. Existing tab sessions with the
previous stored scope require signing in again.
