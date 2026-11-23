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

| Command                   | Behavior                                                               |
| ------------------------- | ---------------------------------------------------------------------- |
| npm run dev               | Wait for PostgreSQL, prepare admin GraphQL, start web/API apps         |
| npm run kill              | Stop this checkout's web/API processes and watchers on Ubuntu/WSL      |
| npm run erm:relay         | ERM StarLink TCP relay to Karma with frame capture                     |
| npm run dev:admin         | Angular watcher                                                        |
| npm run dev:gateway       | Native Router after Nx supergraph generation                           |
| npm run dev:core          | Core watcher                                                           |
| npm run dev:fleet         | Fleet watcher                                                          |
| npm run dev:device-server | Discocan Device Server watcher                                         |
| npm run dev:erm-server    | Independent ERM Server watcher                                         |
| npm run projects          | List Nx projects                                                       |
| npm run lint              | Lint source/tooling and application boundaries                         |
| npm run check             | Build, test and lint only what the change affects, before handing over |
| npm run typecheck         | Check tools and all applications                                       |
| npm run build             | Build all applications                                                 |
| npm run format:check      | Check formatting                                                       |
| npm run codegen           | Generate application GraphQL contracts                                 |
| npm run schema:check      | Compose SDL and validate operations offline                            |
| npm run test:budget       | Count test cases against the repository budget of 60                   |

ESLint requires braces for every conditional and loop body (`curly: ['error', 'all']`),
including single-statement bodies in application code, tests and tools.
The rule is configured after `eslint-config-prettier` so that it remains enabled.

Builds, checks and `start:prod` use `discocan/apps/NAME/dist`; the `npm run dev` watchers for Core, Fleet and Device Server
compile to `discocan/apps/NAME/dist-dev` (`tsconfig.dev.json`), so a check never replaces a running
dev server's files. `npm run start:prod --workspace @osnova/core` (or Fleet, Device Server or ERM Server)
runs the compiled app. Gateway `build` generates the supergraph and
validates the installed native Router configuration. `npm run start:prod --workspace @discocan/gateway`
starts that binary using the generated supergraph; no Node bundle or Rust compilation is involved. `dev` does not migrate or seed databases.
The group generates admin GraphQL artifacts once before starting Angular. Ctrl+C stops the process group; `db:down`
stops PostgreSQL separately and preserves the volume.
See [ERM relay](../discocan/docs/development.md#erm-relay) for the device relay and
[ERM Server](../discocan/docs/development.md#erm-device-server) for its independent compiled service.
Use `npm run kill` from another terminal when application processes remain running. It stops
the dev group, individual Angular/Nest watchers and compiled
web/API backend processes from this checkout,
including the native Router, the concurrently group and their child workers. It sends
SIGTERM, then SIGKILL to survivors after two seconds.
PostgreSQL and processes from other checkouts remain running. Running it again is harmless.
ERM Server is excluded from both `dev` and `kill` to retain long-lived device connections during
web/API restarts.

## Ports and environment

| Application                | Default listener      |
| -------------------------- | --------------------- |
| Angular admin              | 11000                 |
| Gateway GraphQL            | 11010                 |
| Gateway health             | 11016                 |
| Core                       | 11011                 |
| Fleet                      | 11013                 |
| ERM gateway HTTP           | 11015, loopback       |
| ERM api HTTP               | 11017, loopback       |
| Device Server HTTP         | 11019, loopback       |
| ERM read-only recovery TCP | 11510                 |
| ERM gateway TCP            | 11500, all interfaces |
| PostgreSQL                 | 11084                 |
| ERM relay                  | 11500, all interfaces |

The admin listens on all interfaces and accepts `http://dev.lab:11000`; the other HTTP services stay on loopback. ERM Server and the relay share
the default device port and need distinct configured ports when run together. The single root
[`.env.example`](../.env.example) describes all variables, their consumers, safe examples,
types and sensitivity using [`@env-spec` style annotations](https://varlock.dev/reference/data-types/).
These comments document configuration; dotenv and Compose do not validate them, and no
schema validator is installed. Keep this contract in `.env.example` when changing variables.
Defaults work without environment files.
Existing process variables take precedence. Node application PORT must be an integer from 1 to 65535.
Node apps and Prisma read their own workspace `.env`; database provisioning reads root/Core/Fleet/ERM Server.
Router reads exported variables only: migrate any Gateway `.env` overrides into the shell
environment and use `ROUTER_PORT` instead of `PORT`. The admin proxy reads the same `ROUTER_PORT`.

Copy only the relevant entries from the reference into the consuming process's ignored
runtime file, preserving existing settings:

| Consumer                 | Runtime configuration                                                                                                                                            |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Compose and provisioning | Root `.env`: `POSTGRES_PORT`, `POSTGRES_PASSWORD`; Compose also reads `POSTGRES_VOLUME`                                                                          |
| Core and Prisma          | `discocan/config/core.env`: Core database URLs and shared demo settings                                                                                          |
| Fleet and Prisma         | `discocan/apps/fleet/.env`: Fleet database URLs, shared demo settings, `FLEET_ENABLED`, `CORE_GRAPHQL_URL` and admin origins                                     |
| Device Server            | `discocan/apps/device-server/.env`: `DEVICE_SERVER_TOKEN` and optional HTTP `PORT`                                                                               |
| ERM Server and Prisma    | `discocan/apps/erm-server/.env`: ERM database URLs, shared demo settings, `ERM_ROLE`, gateway listener/capture settings, internal API connection and HTTP `PORT` |
| Router and Angular proxy | Export Router variables in the shell that launches npm; proxy reads `ROUTER_PORT`                                                                                |
| ERM relay                | Root `.env`: `ERM_RELAY_HOST`, `ERM_RELAY_PORT`, `ERM_RELAY_UPSTREAM` and `ERM_RELAY_CAPTURE_DIR`                                                                |

An optional `PORT` override belongs only to an individual Node application; omit it to
keep that application's default. Exporting one `PORT` for the development group gives
all subgraphs the same listener port. The reference is scoped by consumer, so copy the
needed entries rather than loading the entire file into a process.

Gateway uses `CORE_GRAPHQL_URL`, `FLEET_GRAPHQL_URL`,
`ERM_SERVER_GRAPHQL_URL` and `ADMIN_ORIGIN`.
Fleet uses `CORE_GRAPHQL_URL`, `FLEET_ENABLED` and `ADMIN_ORIGINS`, a comma-separated
exact origin allowlist with `ADMIN_ORIGIN` as the single-origin fallback. Defaults allow the
Angular loopback origin. Database URLs belong only to Core/Fleet/ERM Server. Device control uses the
[ERM gateway/API workflow](../discocan/docs/development.md#erm-device-server).

The admin reads browser configuration from `discocan/apps/admin/public/config.json` and optional
Git-ignored `discocan/apps/admin/public/config.local.json`. Local configuration overrides the public
file and is excluded from production assets.

The public file requires `graphqlUrl` and optionally accepts `fleetEnabled` (default `true`),
`primeUiLicense`, `googleMapsApiKey` and `googleMapsMapId`. The local file accepts only
`primeUiLicense`, `googleMapsApiKey` and `googleMapsMapId`. Both files still accept
`googleMapsEmbedApiKey` as a fallback when `googleMapsApiKey` is absent or empty. Existing local
keys therefore continue to load, but their Google Cloud API restrictions must permit the
Maps JavaScript API.

All admin maps use the Google Maps JavaScript API through the official
[`@googlemaps/js-api-loader`](https://developers.google.com/maps/documentation/javascript/load-maps-js-api#use_the_npm_js-api-loader_package).
Without a key, the map shows a configuration notice and its accessible record list; record
links to Google Maps still work. The browser key is public configuration. Enable billing and
the [Maps JavaScript API](https://developers.google.com/maps/documentation/javascript/get-api-key)
in the owner's Google Cloud project, authorize that API on the key and restrict the key to the
admin website origins (including the development origins used locally). Maps Embed,
Places and Geocoding APIs are not used.

Advanced Markers require a [JavaScript map ID](https://developers.google.com/maps/documentation/javascript/advanced-markers/add-marker).
`googleMapsMapId` is optional and defaults to `DEMO_MAP_ID` for development/testing. For deployed
use, create a JavaScript map ID in the owner's Google Cloud project and set it explicitly.
`mapTileUrl` and `mapAttribution` are no longer supported.

## Core users and sessions

Apply the additive Core migration before using account authentication, then generate Prisma
and GraphQL clients. Provision the first user for an existing Tenant from the repository root:

```bash
DOTENV_CONFIG_PATH=../../../discocan/config/core.env npm run user:create --workspace @osnova/core -- --tenant TENANT_UUID --email person@example.test --name "First user" < /secure/password-file
```

The password comes only from stdin or the transient `CORE_SETUP_PASSWORD` environment variable;
the environment variable takes precedence. Stdin drops one trailing newline. Never put a password
in command arguments. Passwords accept 12–128 Unicode characters without NUL; names are trimmed
and accept 1–200 characters without NUL. Emails are trimmed, lowercased, validated and globally
unique. Repeating setup with an existing email refuses without modifying the user. The setup
command uses Core's `CORE_DATABASE_URL` and does not create Tenants or apply migrations.

Core GraphQL provides `signIn(email, password)` returning `{ token, user, tenant, expiresAt }`.
Send the opaque token as `authorization: Bearer <token>`; only its hash is stored. Sessions expire
eight hours after sign-in. `me` returns the current User including `tenant`; `users` lists all
active and inactive users in that Tenant. Every authenticated user has equal access to
`createUser(name, email, password)`, `updateUser(id, name, email)`, `deactivateUser(id)` and
`reactivateUser(id)`. These account operations require a user session and no Branch context.
`updateProfile(name, email)` edits the current user. `changePassword(currentPassword, newPassword)`
revokes the user's other sessions while retaining the current one. `signOut` revokes the current
session; deactivation revokes all of the target user's sessions. Reactivation requires a fresh
sign-in. User timestamps and session expiry use `DateTime`, serialized in UTC with milliseconds.
Invalid sign-in credentials share one `UNAUTHENTICATED` message. Invalid account fields return
`BAD_USER_INPUT` with `fieldErrors`; foreign or missing user mutations return `NOT_FOUND`.

For service-to-service verification, configure the same private `CORE_INTERNAL_AUTH_TOKEN`
(at least 32 characters) in Core, Fleet and ERM API's ignored `.env` files. In Fleet and ERM API,
set `CORE_AUTH_VERIFY_URL` to Core's full verification endpoint; when omitted it defaults to
`http://127.0.0.1:11011/internal/auth/verify`.
`POST /internal/auth/verify` accepts the user's bearer in `authorization` and the
internal secret in `x-core-internal-token`, with no request body. It returns HTTP 200 and exactly
`{ tenantId, userId, sessionId }` for a valid user session, HTTP 401 for invalid internal or session
credentials, or HTTP 503 when the internal secret is unconfigured. Identity headers such as
`x-tenant-id` and `x-user-id` are ignored. HTTP responses use `Cache-Control: no-store`.
Fleet and ERM accept these sessions and cache successful identities in memory for five seconds,
keyed by the token hash. Failed verifications are not cached; revoked sessions lose access within
five seconds. Configure the internal secret before using real sessions in either service.
Router propagates `authorization`, `x-branch-id` and `x-request-id`; Branch context never supplies
Tenant identity. The explicit development demo login continues to work independently; rejected
real sessions never fall back to demo authentication.

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
the binary and upstream license notices in ignored `osnova/tools/router/dist/`.
It requires no npm dependency, Rust toolchain, container, GraphOS account or API key.
`dev:discocan` waits for PostgreSQL and starts Router, Core, Fleet, Device Server and Angular
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

The [Router configuration](../discocan/apps/gateway/router/router.yaml) reads exported process variables;
it does not load `discocan/apps/gateway/.env`. Defaults are:

| Variable               | Default                        |
| ---------------------- | ------------------------------ |
| ROUTER_PORT            | 11010 (`/graphql` on loopback) |
| ROUTER_HEALTH_PORT     | 11016 (`/health` on loopback)  |
| CORE_GRAPHQL_URL       | http://127.0.0.1:11011/graphql |
| FLEET_GRAPHQL_URL      | http://127.0.0.1:11013/graphql |
| ERM_SERVER_GRAPHQL_URL | http://127.0.0.1:11017/graphql |
| ADMIN_ORIGIN           | http://127.0.0.1:11000         |

ERM Server is the third subgraph, served by `ERM_ROLE=api` on HTTP 11017. The independent
`ERM_ROLE=recovery` process serves the read-only configuration listener on TCP 11510 and
needs its own user unit and ERM database access. It has no HTTP endpoint. The
`ERM_ROLE=gateway` process keeps device TCP sessions on 11500 and its internal API on 11015;
`npm run dev` and `npm run kill` continue to exclude it. Set its shared `DEMO_AUTH_ENABLED` and
`DEMO_AUTH_SECRET` consistently with the other subgraphs. After adding or changing its endpoint,
regenerate the supergraph and restart Router with the exported `ERM_SERVER_GRAPHQL_URL`.
See [ERM inspection](../discocan/docs/development.md#graphql-and-admin-inspection) for Branch-scoped device inspection and the six allowlisted operator reads.

For example, `ROUTER_PORT=11018 npm run dev` changes Router's GraphQL listener and the Angular proxy together; health remains on 11016.
The configured origin can send GET/POST/OPTIONS with `authorization`, `content-type`,
`x-branch-id` and `x-request-id`. The three context headers are forwarded to all subgraphs.
Health returns `{"status":"UP"}` from the dedicated health port, independently of downstream health.

The [Rhai compatibility hook](../osnova/tools/router/compatibility.rhai)
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
- Subgraph requests have a five-second timeout. Transport failures, malformed upstream
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
There is no JavaScript Gateway fallback or runtime selector. The [federation check](testing.md#federation)
asserts the public contract through Router over real subgraphs and isolated test databases.

## Domain development

- [Discocan development](../discocan/docs/development.md): telemetry admin, demo login, Vehicles/Devices and API usage.
- [Ecommerce Branches](branches.md): Branch discovery contracts and implementation.

## Angular presentation and agent tools

### Admin presentation

The [admin design system](admin-design-system.md) describes the implemented theme (`discocanPreset`
over standard Aura), global styles, shell, patterns and the design page; the decision is
[ADR 0004](architecture/decisions/0004-admin-design-system.md). The root font size is the browser
default (16 px). Lato weights 400, 500, 600, 700 and 800, including Cyrillic glyphs, are served
from `discocan/apps/admin/public/fonts/lato`; no external font CDN is required. Font sources and licenses
are recorded in [the admin attribution](../discocan/apps/admin/THIRD_PARTY_NOTICES.md).

### Angular agent tools

The repository includes the official
[Angular developer skill](../.agents/skills/angular-developer/SKILL.md) from
[angular/skills](https://github.com/angular/skills), revision
`eaf83d2c88fb5fa1449cf717792d32f1463dc1b9`. It is an unchanged upstream snapshot in
`.agents/skills/angular-developer`; Prettier excludes that directory. Update it deliberately
from the official source, keeping its referenced files together. Codex discovers repository
skills automatically; start a new turn, or restart Codex if the new skill does not appear.

[osnova-admin-development](../.agents/skills/osnova-admin-development/SKILL.md) adds only
DiscoCan's application boundaries, generated contracts, lifecycle and check selection.
[osnova-admin-design-system](../.agents/skills/osnova-admin-design-system/SKILL.md) covers central
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

The root Prettier configuration selects the Angular parser for `discocan/apps/admin/src/**/*.html`,
including suffixless component templates. To format or check only these templates:

```bash
npm exec -- prettier --write 'discocan/apps/admin/src/**/*.html'
npm exec -- prettier --check 'discocan/apps/admin/src/**/*.html'
```

## GraphQL and generation

SDL and named operation paths are explicit in `discocan/tools/graphql/contracts.mts`. Runtime Fleet
loads its common SDL followed by the Vehicle, Device, Driver, Vehicle group, Telemetry, Trip,
Event, Service task, Overview and Settings SDL in the same order;
Gateway loads the generated static supergraph. No database or running
backend is required for codegen/schema validation. Generated outputs stay ignored.
Codegen maps `ID` to `string`; on the servers `DateTime` is a `string` input (validated by the
service) and a `Date` output, and the calendar `Date` scalar is a `YYYY-MM-DD` string. Admin
operations receive both as strings.

```bash
npm run codegen
npm run schema:check
```

Regenerate and restart after SDL/operation changes. Domain API examples are in
[Discocan development](../discocan/docs/development.md#graphql-usage) and
[Ecommerce Branches](branches.md#graphql-contracts).

## PostgreSQL and Prisma

Only PostgreSQL runs in Compose; migrations, seeds and test processes run on the host.

```bash
npm run db:up
npm run db:setup
npm run db:test:setup
npm run db:migrate
npm run db:seed
```

Provisioning creates/verifies six databases and matching roles, preserves existing data and
passwords, checks role privileges/ownership and revokes PUBLIC database access. The loopback
provisioning role is `discocan_admin`; application URLs never use it.

| Service    | Development database/role | Test database/role  | Environment variables                       |
| ---------- | ------------------------- | ------------------- | ------------------------------------------- |
| Core       | discocan_core             | discocan_core_test  | CORE_DATABASE_URL, CORE_TEST_DATABASE_URL   |
| Fleet      | discocan_fleet            | discocan_fleet_test | FLEET_DATABASE_URL, FLEET_TEST_DATABASE_URL |
| ERM Server | discocan_erm              | discocan_erm_test   | ERM_DATABASE_URL, ERM_TEST_DATABASE_URL     |

Roles cannot connect to another service's databases or the corresponding dev/test database.
The [root environment example](../.env.example) configures POSTGRES_PORT, POSTGRES_PASSWORD and POSTGRES_VOLUME.
If overriding the port, update application/test URLs too. Setup accepts only expected identities
on 127.0.0.1 at that port. Examples do not replace credentials in existing installations.
Compose project `discocan` mounts `discocan_postgres_data` at `/var/lib/postgresql` by default.
Set `POSTGRES_VOLUME` in the root `.env` to use another named volume. Compose creates a missing
volume, so verify the name exists before switching when retaining data. To migrate an older
installation, stop PostgreSQL before copying its volume, preserve the original, and select the
copy. A copied volume retains its existing database names, roles and passwords; migrate those
and apply the new schema migrations before using the current application configuration. Never
run two PostgreSQL containers against the same data volume. `db:down` preserves the volume.
Do not delete volumes or reset databases to repair setup.

Core/Fleet/ERM Server own their schemas, generated Prisma clients and reviewed SQL migrations. Core/Fleet start
with `20261102000000_baseline`, which replaces the pre-release migration history. Tables, enum
types and enum values use camelCase database mappings; TypeScript and GraphQL names stay unchanged.
Branch places `tenantId` immediately after `id`. The nine scoped Fleet
tables (`FleetSettings`, `Vehicle`, `Device`, `Driver`, `VehicleGroup`,
`VehicleStatusSample`, `Trip`, `FleetEvent`, `ServiceTask`) begin with `id`, `tenantId`, `branchId`.
Scoped Fleet foreign keys and natural-key uniqueness include Tenant/Branch. `db:migrate`
deploys Core, Fleet and ERM Server; `db:generate` generates all three ignored clients. Initial migrations require empty databases; a previous migration history needs an
explicitly authorized database rebuild. `db:migrate` never resets databases. Subsequent schema
changes require new reviewed SQL migrations, not edits to applied history or db push.

Produce Fleet migration SQL from `discocan/apps/fleet` (the CLI needs its `prisma.config.ts`): copy the
committed schema outside the repository, edit `prisma/schema.prisma`, run `npm run db:validate`,
then `npx prisma migrate diff --from-schema "$PREV" --to-schema prisma/schema.prisma --script`.
Wrap the output in `BEGIN;`/`COMMIT;`, append the hand-written CHECK constraints Prisma cannot
express and review the generated SQL. Regenerate clients/contracts (`npm run db:generate`, `npm run codegen`) and
restart after `npm run db:migrate`.
`db:seed` inserts RentalSofia, Discordia and Sandbox Branches, two Discordia Vehicles and one Device
with a leading-zero IMEI. Existing keys and edits are preserved. Core runs before Fleet; Fleet
fixtures belong to RentalSofia's Discordia Branch.

The [Simple eData catalog procedure](../discocan/docs/erm-resources/simple-edata-catalog/README.md)
uses direct commands for EXE inspection, extraction, comparison and local Fleet import.
It is separate from the sample-data seed and has no npm workflow registration.

## Troubleshooting

Use `nvm use` when node/npm are unavailable. Check Docker before `db:up`; setup and migration
are explicit prerequisites. Check application health endpoints and GraphQL errors separately.
A health response does not prove database readiness. Regenerate contracts and restart the group
when SDL/operations change. Check the selected Branch and Fleet startup/backend flags for
unavailable business screens. See [testing](testing.md) for guarded fixtures and cleanup.

## Holita

Holita runs its Admin, Backoffice and Sales applications on ports 12000, 12001 and 12002. Its
operator Router uses 12010 (health 12016), Core uses 12011 and Commerce uses 12013. The
storefront app uses 12020 and its public Router uses 12030 (health 12036). Open a shop at
`/s/<branchId>`. The first local
setup creates ignored, private `holita/config/core.env`, `commerce.env` and `seed-accounts.env` with
`npx tsx holita/tools/runtime-config.mts`; preserve these files on subsequent runs. Provision and
seed Holita without changing Discocan databases:

```bash
npm run db:setup:holita
npm run db:test:setup:holita
npm run db:migrate:holita
npm run db:seed:holita
npm run dev:holita
```

Existing Holita checkouts need `HOLITA_COMMERCE_IMAGE_DIR` in `holita/config/commerce.env`.
Set it to the absolute path of `.volumes/holita/images` in the checkout before seeding.
Set a separate generated `HOLITA_DEMO_SHOPPER_PASSWORD` in the ignored
`holita/config/seed-accounts.env` before reseeding. The Sofia storefront shopper
`shopper@demo.holita.test` starts with two available variants in the cart.
Admin uploads brand logos and product photos through the operator graph. Serve
`/media/brands/` and `/media/products/` from Commerce on both the Admin and storefront origins.
Direct public product image URLs work only while the product is active and has an active variant.

The Storefront Router applies its general limit of 100 requests per second to incoming traffic.
Commerce applies a separate quota of four shopper sign-in attempts per ten seconds per instance.
When the sign-in quota is reached, the storefront asks the shopper to wait and retry.

Use Gallery in the Product drawer to add JPEG, PNG or WebP photos, enter alt text, reorder or
remove photos, then save the product. The first photo is the storefront cover. Add up to 5 MiB
of new photos per save. If the picker rejects files, choose new photos or discard that selection
before saving. The operator graph reports individual photo errors with flat keys such as
`image0Upload`, `image0Id` and `image0AltText`. Indexes start at zero. The demo catalogue includes
covers and a three-photo gallery for the „Орех“ baking pot.

Open **Dashboard** in Admin for the selected shop's order count, completed order revenue, new
customers and tracked variants at zero stock. Choose 7, 14 or 30 days (the default). The date window
includes today in Europe/Sofia and groups orders by placement day. Revenue sums the saved BGN
totals of completed orders, including delivery. Current stock and the eight latest orders stay
independent of the period. An order number opens its Order Detail page.

The operator graph exposes this read as `shopDashboard(period: DashboardPeriod! = DAYS_30)`.
The period covers the date range, dated totals and daily chart values. It also returns the current
stock count and recent orders. The selected shop comes from the verified operator scope.

In Admin, use Categories to create, move and reorder shop categories. The Product drawer assigns
one category per product. The public `catalogueCategories` query returns the active tree, and the
storefront shows each product's active category path in its breadcrumbs. A hidden ancestor
suppresses the whole subtree. The Sofia demo shop includes Kitchen and Home trees with products in
their child categories.

In Admin, use Collections to group products for the selected shop. Choose a manual collection
to select products and arrange their order, or choose a category or brand rule to include
products directly assigned to that category or brand. To take a collection offline, turn off
its active status. A category or brand used in a rule can be deleted after the rule is changed.
The Sofia demo shop includes the curated Kitchen Essentials collection and a Cookware collection.

Shop navigation links to category, brand, collection and tag indexes beneath `/s/<branchId>`.
Open an index entry to browse products by its slug. Category listings include visible descendants
and link to direct subcategories. Tags appear in the index while assigned to a public product.
Manual collections preserve the saved order by default, and rule-based collections sort by name.

The public `catalogue` and `catalogueCategoryProducts`, `catalogueBrandProducts`,
`catalogueCollectionProducts` and `catalogueTagProducts` queries accept filters, sorting and paging.
The storefront stores browsing state in the URL with `q`, `sort`, `minPrice`, `maxPrice`,
repeated `brand` and `option` IDs, `inStock=1` and one-based `page`. The sort values are
`name-asc`, `name-desc`, `price-asc` and `price-desc`. Copy the URL after applying filters to
share the same view. Price bounds use the displayed price, and selected option values and
the in-stock filter must match the same active variant.

In Admin, open Characteristic groups to define product specifications and set the display order
and active status of each group and characteristic. In the Product drawer, enter text in
Specifications. Clearing a value removes it. Deactivating a group or characteristic hides its
specifications and preserves the saved values. Shoppers see populated groups in the saved order
on the product detail page. The public graph exposes `catalogueProductSpecifications(productId)`.
The Sofia demo shop includes Material and Finish values on a ceramic baking dish and an oak bowl.

In Admin, use Options to define reusable options for the selected shop. The drawer lets you set
the option's status and filter visibility, edit its text values and move them into order. The Sofia
demo shop includes Colour and Size. The operator graph exposes `options`, `option`, `createOption`
and `updateOption`. To delete a value used by a product variant, first remove the variants using
that value. Variants with stock still eligible for restoration can be deactivated until then.

In Admin, open a product and edit its Variants section. Leave option values empty for the
default variant of a simple product. For a configurable product, add one row per combination
and choose one value from each of the same options in every active row. Each variant has a shop-unique
SKU, price, inventory tracking and status. A saved variant keeps its combination. To offer a
different combination, add a new variant and set its own initial quantity if tracked. Set the
original variant to Inactive to stop selling it. When a simple product gains options, set its
original variant to Inactive and keep it for any stock that may still need to be restored.
For a saved variant, search Inventory by product name or SKU, then open the variant to view its
details or set its tracked stock count. Filter by tracking status or show only tracked variants
with zero stock.
Omit quantity for saved variants in `updateProduct`. The mutation rejects a supplied quantity
that differs from the saved stock count.

The storefront lists active products with an active variant and shows the lowest active variant
price on catalogue cards. The public `CatalogueProduct.available` field reports whether any active
variant is available. On a product page, `CatalogueProduct.variantSelection` supplies the active
variants and their public option labels. The page starts with the first available variant in the
merchant's saved order, or the first active variant when all are sold out. Choosing a combination
updates its price and availability. A variant is available when it has stock or sells without
inventory tracking. The Sofia demo shop includes a configurable product with two differently
priced combinations, one in stock and one sold out.

Select an available variant and quantity on the product page, then add it to the cart. The cart
shows product thumbnails, current prices and availability, supports quantity changes and removal, and excludes blocked lines
from the subtotal. Signing in merges eligible guest quantities and shows any skipped items.
The storefront graph exposes `cart`, `addCartLine`, `updateCartLine` and `removeCartLine`.
Send the guest credential in `x-cart-token` or use the same-shop shopper bearer after signing in.

In Admin, open Discounts to create or edit a promo code for the selected shop. Set a fixed amount
or a percentage, enable the code, and optionally set its dates, minimum item subtotal and total
use limit. The list shows how many orders have used each code. The operator graph exposes
`discounts`, `discount`, `createDiscount` and `updateDiscount`.

Shoppers can apply or remove one promo code in Cart through `applyCartDiscount` and
`removeCartDiscount`. The Sofia demo code `HOME10` gives 10% off an item subtotal of at least
40.00 BGN. `OLD10` has expired.

In Admin, open Payment methods or Shipping methods for the selected shop. Add or edit a method,
enter its label and sort order, and set payment instructions or a fixed delivery fee in BGN.
Enable the method to offer it at checkout, or disable it to take it out of the available choices.
Lower sort orders appear first. Existing orders retain the method names, instructions and delivery
fee recorded when they were placed.

Open Checkout from a cart with available items, enter contact and delivery details, and choose
delivery and payment. Review total shows current item prices, any item discount and the fixed
delivery fee from Commerce. The Sofia seed enables Наложен платеж, Банков превод and
Доставка до адрес (6.00 BGN). Доставка в събота (9.50 BGN) starts disabled.
The storefront graph exposes the checkout options with `checkout` and prices the selected options
with `quoteCheckout`, using the cart's existing authorization.

After reviewing the total, choose Place order. A change in available stock, prices, discount or
selected methods prompts you to review the checkout again. If the promo code is no longer eligible,
go back to Cart to remove or replace it. When an order commits, Commerce saves the code and the
discount amount on the order and records the redemption.
The confirmation shows the order's current fulfillment and payment status with its saved items,
promo code, discount, payment instructions and delivery fee.
Signed-in shoppers can reopen their confirmation in the same shop. If the Place order response
is lost, reloading Checkout in the same signed-in browser session opens the original confirmation.
Guests can reopen their confirmation in the browser that placed the order for 24 hours after
Commerce consumes the cart. The same guest window applies to reloading Checkout after a lost
response or retrying a placement that already committed. If the cart is still active after an
interrupted checkout, enter the checkout details and review the total again before placing the order.
The storefront graph uses `placeOrder` with the reviewed cart ID and quote revision, and
`orderConfirmation` with the order ID and the placing shopper's authorization.
`shopperOrderConfirmation` recovers a placed order by cart ID using the shopper's session in
the same shop. `guestOrderConfirmation` uses the original cart credential in that shop.

Sign in to the shop and open Account → My orders. The list and detail show orders linked to that
shopper, with the current statuses and saved checkout details. Use Back to orders
to return to the same list page. The Sofia demo shopper has placed, confirmed, shipped and
completed orders. The shipped example is marked paid. The storefront graph exposes `shopperOrders`
and `shopperOrder` for this history.

In Admin, open Customers and select a customer in the current shop. Use Edit contact to change
the name or optional phone. The sign-in email is read-only. Add or edit saved addresses from the
same page, and open any linked order from Order history. The Customers link returns to the list
with its previous page and page size. Existing orders keep the contact and
address details recorded on the order. The Sofia demo shop includes a customer with a phone,
saved address and linked order. The operator graph exposes `customer`, `updateCustomerContact`,
`createCustomerAddress`, `updateCustomerAddress` and the `customerId` filter on `orders`.

In Admin, open Orders in the selected shop. Search by order number, contact name, email or phone,
or filter by fulfillment status. The list URL stores search and filter values. Open an order to
see its saved contact, delivery and payment details, charged fee, items, promo code, discount,
totals and dated fulfillment history. Use Update status to advance from Placed through Confirmed, Processing,
Shipped and Completed. Cancelling before shipment returns the original deductions to any
surviving variants once. Use Mark as paid to record manual payment. Cancellation preserves a
recorded payment. The operator graph exposes `orders`, `order`, `updateOrderStatus` and
`markOrderPaid`.

Choose Create manual order to record a phone order. Select a customer to link it to their
shop order history or leave it as a guest order. Customer selection fills untouched contact
fields using the account name and email, and the phone from its latest linked order when the email
matches. Enter delivery details, add variants, select enabled payment and shipping methods, and
optionally enter a private merchant note.
Open a placed, unpaid manual order and choose Edit manual order to revise it. Commerce derives
totals and adjusts stock by the change in held quantities. Existing lines retain their booked
prices, and unchanged methods retain their saved terms. Once an invoice is issued, the items
and shipping method and charge become read-only. Contact, delivery address, payment method and
merchant note remain editable while the order is placed and unpaid. The Sofia demo shop includes
two guest phone orders, one with an issued invoice. The operator graph exposes
`manualOrderMethods`, `createManualOrder` and `updateManualOrder`.

On Order Detail, choose Create invoice, enter the invoice number and issuer details, and
review the recipient and amounts copied from the order. Each shop uses unique invoice numbers.
Open the issued document from its numbered link on the order. Its totals include any saved
discount deduction. Later changes to the order leave the invoice intact. The Sofia demo shipped
order has an issued invoice. The operator graph exposes `orderInvoice` and `issueOrderInvoice`.

After returning money outside Holita, use Record refund on a paid order. Order Detail shows the
refund history and remaining balance, including the delivery fee in the original paid amount.
A refund of the full remaining balance can restore the original stock deductions. It cancels
orders that have yet to ship and preserves the status of shipped and completed orders. For an order already
cancelled, the option records the restock choice and leaves stock as it is. The Sofia demo includes
a partially refunded paid order. The operator graph exposes `orderRefundSummary` and
`recordOrderRefund`.

The Product drawer's Descriptions section accepts optional Bulgarian and English plain text.
The storefront product page shows the selected language when available and falls back to the
other description. The Sofia demo shop includes a bilingual ceramic casserole under Cookware.

In Admin, use Badges to manage the badge names, slugs, colours, display order and active status
for the selected shop. In the Product drawer, choose badges and search for or add reusable tags.
Adding a tag makes it available in the shop immediately. Save the product to apply its
assignments. The storefront shows active badges on catalogue cards and tags on product pages.
Deactivating a badge hides it from shoppers and keeps its assignments.

In Admin, open Pages for the selected shop. Give the page a shop-unique slug and enter plain-text
titles and bodies. Set the status to Published once at least one language has both a title and a
body. Share the path shown beside the published page, `/s/<branchId>/pages/<slug>`.
The storefront uses the shopper's language when its title and body are both present and falls
back to the other language as a pair. Returning the page to Draft removes it from public reads.
The operator graph exposes `shopPages`, `shopPage`, `createShopPage` and `updateShopPage`.
The storefront graph exposes `shopPage(slug: ...)` for published pages in the current shop.

In Admin, open Blog Tags to create reusable names and shop-unique slugs. In Blog Articles,
write Bulgarian and English plain-text content and choose tags for the article. Publishing
requires a title and body in at least one language. The publication time is set when an article
goes live. Returning it to Draft removes it from the public blog and clears its publication time.
Shoppers can open Blog at `/s/<branchId>/blog` and share a tag filter using `?tag=<tagSlug>`.
Published articles appear newest first, and each detail page lives at `/s/<branchId>/blog/<slug>`.
The storefront graph exposes `blogArticles`, `blogArticle` and `blogTags` for published content.
The operator graph also provides article and tag creation and updates, plus `blogTagChoices` for
article assignments.

In Admin, open Navigation for the selected shop to create a Header or Footer menu. Add links
with a Bulgarian or English label, choose a shop destination or enter an HTTP(S) URL, and move
links into the order shoppers should see them. The storefront graph exposes `shopNavigation`
with both placements in saved order. A hidden or unpublished destination is omitted while it
is unavailable. Save a menu with no links to clear its placement.

In Admin, open General Settings to update the selected shop's public display name, email,
phone and address. Save publishes those values to the storefront. Discard changes restores
the last saved form values. Leaving the page with unsaved changes, including when switching
the Admin language, asks whether to keep editing or discard the draft. Clear the display name
to use the shop's Branch name. The storefront shows available details in its footer and at
`/s/<branchId>/contacts`. The operator
graph exposes `shopSettings` and `updateShopSettings`, and the storefront graph exposes the
public fields on `shop`.

`npm run dev` starts both products. `npm run kill` stops their development applications while
leaving PostgreSQL and the ERM units running. Discocan Core reads `discocan/config/core.env`;
Holita Core reads `holita/config/core.env`. Their watch outputs are `dist-discocan` and
`dist-holita` under the shared Core project.
