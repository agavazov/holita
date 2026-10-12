# Local development

## Prerequisites and installation

Use Ubuntu/WSL, Node.js 24.15+ and npm 11. The pinned package manager is npm 11.19.0.

```bash
nvm use
npm ci
```

Run `nvm install` first if needed. Non-interactive shells may need to source `$HOME/.nvm/nvm.sh`
before `nvm use`. Native Windows execution is outside the verified setup.

## Commands

| Command                  | Behavior                                                              |
| ------------------------ | --------------------------------------------------------------------- |
| npm run dev              | Wait for PostgreSQL, start Angular and four Nest backends             |
| npm run kill             | Stop this checkout's application processes and watchers on Ubuntu/WSL |
| npm run dev:admin        | Angular watcher                                                       |
| npm run dev:gateway      | Gateway watcher                                                       |
| npm run dev:core         | Core watcher                                                          |
| npm run dev:fleet        | Fleet watcher                                                         |
| npm run dev:karma-client | Karma Client watcher                                                  |
| npm run projects         | List five Nx applications                                             |
| npm run lint             | Lint source/tooling and application boundaries                        |
| npm run typecheck        | Check tools and all applications                                      |
| npm run build            | Build all applications                                                |
| npm run format:check     | Check formatting                                                      |
| npm run codegen          | Generate application GraphQL contracts                                |
| npm run schema:check     | Compose SDL and validate operations offline                           |

Backend output is `apps/NAME/dist`; `npm run start:prod --workspace @holita/core`
(or gateway/fleet/karma-client) runs the compiled app. `dev` does not migrate or seed databases.
Ctrl+C stops the process group; `db:down` stops PostgreSQL separately and preserves the volume.
Use `npm run kill` from another terminal when application processes remain running. It stops
the dev group, individual Angular/Nest watchers and compiled backend processes from this checkout,
including their child workers. It sends SIGTERM, then SIGKILL to survivors after two seconds.
PostgreSQL and processes from other checkouts remain running. Running it again is harmless.

## Ports and environment

| Application   | Default loopback port |
| ------------- | --------------------- |
| Angular admin | 11000                 |
| Gateway       | 11010                 |
| Core          | 11011                 |
| Fleet         | 11013                 |
| Karma Client  | 11014                 |
| PostgreSQL    | 11084                 |

Visual previews use 11000–11009; the optional Sakai preview uses 11002. Application-local
`.env.example` files describe PORT and service URLs. Defaults work without environment files.
Existing process variables take precedence. Backend PORT must be an integer from 1 to 65535.
Apps and Prisma read their own workspace `.env`; database provisioning reads root/Core/Fleet.

Gateway uses `CORE_GRAPHQL_URL`, `FLEET_GRAPHQL_URL`, `KARMA_CLIENT_GRAPHQL_URL` and `ADMIN_ORIGIN`.
Fleet uses `CORE_GRAPHQL_URL`, `FLEET_ENABLED` and `ADMIN_ORIGINS`, a comma-separated
exact origin allowlist with `ADMIN_ORIGIN` as the single-origin fallback. Defaults allow the
Angular loopback origin. Database URLs belong only to Core/Fleet. Karma Client has application-local account settings described in
[Karma Client configuration](discocan/development.md#karma-client). No upload/storage
configuration is required.

## Domain development

- [Discocan development](discocan/development.md): telemetry admin, demo login, Vehicles/Devices and API usage.
- [Ecommerce Stores](ecommerce/stores.md): Store discovery contracts and implementation.

## Angular presentation and agent tools

### Sakai source reference

The Angular admin uses Sakai's 14px root scale, PrimeNG 22's
[`aura-compat` preset](https://primeng.dev/theming/styled#base-font-size) and Lato.
The compatibility preset preserves control typography and spacing at a 14px root.
[The preset composition](../apps/admin/src/app/layout/sakai-preset.ts) imports the original
Aura base and only the component presets used by the admin, including PrimeNG's internal
dependencies. When introducing another PrimeNG control, include its preset and any component
dependencies there; keep the original tokens and review both themes at the same viewport sizes.
Font weights 400, 500, 600, 700 and 800 are served from `apps/admin/public/fonts/lato`, including Cyrillic glyphs;
no external font CDN is required. Font sources and licenses are recorded in
[the admin attribution](../apps/admin/THIRD_PARTY_NOTICES.md).

Sakai is the Angular admin's theme and visual reference for shell and feature presentation,
including spacing, typography, geometry and responsive layout.
Concrete Angular features supply contracts, validation and request lifecycles.

The local Sakai Angular source is `.references/sakai-ng`, outside `apps/` and the npm
workspaces. Git, Nx, ESLint and Prettier ignore `.references/`. The checkout is a source
reference for the Angular admin's layout and visual comparisons; the application does
not import or load files from it, and normal installation/build/test commands do not
require it. No template dependencies are installed by the workspace.

The reference uses [PrimeTek's official repository](https://github.com/primefaces/sakai-ng)
at revision `96d71496d685b5c110efd2875abaa2bf89a56ad2`. Its `src/assets` submodule is
[sakai-assets](https://github.com/cetincakiroglu/sakai-assets) at
`eaa70ece4cfa9aeb8f60b36dce5a422b6bae8003`. To recreate the checkout from the repository root
when the destination does not exist:

```bash
git clone https://github.com/primefaces/sakai-ng.git .references/sakai-ng
git -C .references/sakai-ng checkout --detach 96d71496d685b5c110efd2875abaa2bf89a56ad2
git -C .references/sakai-ng submodule update --init --recursive
```

For an optional rendered comparison, install the reference's own locked dependencies
and run its existing preview script from that checkout:

```bash
cd .references/sakai-ng
nvm use
npm ci --no-audit --no-fund
npm start -- --host 127.0.0.1 --port 11002
```

Open `http://127.0.0.1:11002/pages/empty` for the shell,
`/pages/crud` for the template's CRUD presentation and `/uikit/formlayout` for forms.
Use another free port if needed. The reference has its own dependencies and cache;
it does not change holita's lockfile or join the workspace. Stop its preview after
the comparison. Temporary comparison captures belong in the ignored `.references/review/`.

Use `src/app/layout/component` for the original shell components, `src/app/layout/service`
for their presentation state, and `src/assets/layout` for layout SCSS. Compare the original
and holita at matching viewport sizes. The reference uses Angular/PrimeNG 21; holita uses
Angular/PrimeNG 22, so component APIs must follow the installed versions and current
official metadata. The upstream template contains demo routes and dependencies that are
not part of holita. The adapted files and their licenses are recorded in
[the admin attribution](../apps/admin/THIRD_PARTY_NOTICES.md).

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
loads Vehicle/Device SDL; Gateway loads the generated static supergraph. No database or running
backend is required for codegen/schema validation. Generated outputs stay ignored.

```bash
npm run codegen
npm run schema:check
```

Regenerate and restart after SDL/operation changes. Domain API examples are in
[Discocan development](discocan/development.md#graphql-usage) and
[Ecommerce Stores](ecommerce/stores.md#graphql-contracts).

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

Core/Fleet own their schemas, generated Prisma clients and reviewed SQL migrations. Each service
has one initial migration for the complete tenant-scoped schema. Store, Vehicle and Device place
tenantId immediately after id. The Device FK includes Tenant/Store/Vehicle, and IMEI uniqueness
includes Tenant/Store. `db:migrate` deploys Core then Fleet; `db:generate` generates both ignored
clients. Initial migrations require empty databases; a previous migration history needs an
explicitly authorized database rebuild. `db:migrate` never resets databases. Subsequent schema
changes require new reviewed SQL migrations, not edits to applied history or db push.
`db:seed` inserts RentalSofia, Discordia and Sandbox Stores, two Discordia Vehicles and one Device
with a leading-zero IMEI. Existing keys and edits are preserved. Core runs before Fleet; Fleet
fixtures belong to RentalSofia's Discordia Store.

## Troubleshooting

Use `nvm use` when node/npm are unavailable. Check Docker before `db:up`; setup and migration
are explicit prerequisites. Check application health endpoints and GraphQL errors separately.
A health response does not prove database readiness. Regenerate contracts and restart the group
when SDL/operations change. Check the selected Store and Fleet startup/backend flags for
unavailable business screens. See [testing](testing.md) for guarded fixtures and cleanup.
