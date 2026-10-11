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

| Command               | Behavior                                                              |
| --------------------- | --------------------------------------------------------------------- |
| npm run dev           | Wait for PostgreSQL, start Angular and three Nest backends            |
| npm run kill          | Stop this checkout's application processes and watchers on Ubuntu/WSL |
| npm run dev:admin     | Angular watcher                                                       |
| npm run dev:gateway   | Gateway watcher                                                       |
| npm run dev:core      | Core watcher                                                          |
| npm run dev:reference | Reference watcher                                                     |
| npm run projects      | List four Nx applications                                             |
| npm run lint          | Lint source/tooling and application boundaries                        |
| npm run typecheck     | Check tools and all applications                                      |
| npm run build         | Build all applications                                                |
| npm run format:check  | Check formatting                                                      |
| npm run codegen       | Generate application GraphQL contracts                                |
| npm run schema:check  | Compose SDL and validate operations offline                           |

Backend output is `apps/NAME/dist`; `npm run start:prod --workspace @holita/core`
(or gateway/reference) runs the compiled app. `dev` does not migrate or seed databases.
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
| Reference     | 11013                 |
| PostgreSQL    | 11084                 |

Visual previews use 11000–11009; the optional Sakai preview uses 11002. Application-local
`.env.example` files describe PORT and service URLs. Defaults work without environment files.
Existing process variables take precedence. Backend PORT must be an integer from 1 to 65535.
Apps and Prisma read their own workspace `.env`; database provisioning reads root/Core/Reference.

Gateway uses `CORE_GRAPHQL_URL`, `REFERENCE_GRAPHQL_URL` and `ADMIN_ORIGIN`.
Reference uses `CORE_GRAPHQL_URL`, `REFERENCE_ENABLED` and `ADMIN_ORIGINS`, a comma-separated
exact origin allowlist with `ADMIN_ORIGIN` as the single-origin fallback. Defaults allow the
Angular loopback origin. Database URLs belong only to Core/Reference. No upload/storage
configuration is required.

## Angular admin foundation

Prepare databases, migrate and seed, then run `npm run dev` and open
[Angular admin](http://127.0.0.1:11000). Choose RentalSofia in the Tenant dropdown, then choose a Store in the second dropdown and sign in to open Vehicles. Login has its own Sakai layout without the application header/sidebar. Vehicles and Devices are under Workspace; the header Store selector switches the active Store.
`dev:admin` runs Angular alone when the backends are available. Development defaults to `/bg`;
`/en` selects English. Store/language/list query survive reloads. Language switching keeps
path/query/hash; Store switching preserves Vehicles/Devices and resets the list context.

The shell uses Sakai, local Lato and PrimeNG Aura compatibility tokens. Desktop navigation can
collapse; mobile navigation opens a modal Drawer. Below 992px one Store selector moves into a
second 56px header row. Resizing preserves drafts and closes obsolete overlays.
Themes persist in `holita.admin.theme`; denied storage displays a status message.

`apps/admin/public/config.json` supplies `graphqlUrl`, optional boolean `referenceEnabled`
and optional `primeUiLicense`. GraphQL may use a root-relative endpoint or an absolute HTTP(S)
URL without credentials/fragment. The development proxy forwards `/graphql` to Gateway.
Startup validates configuration before bootstrap and displays a localized error on failure.
Issued license keys stay private and must not be committed. Browser fixtures use their own config.
`referenceEnabled` defaults true; false hides business navigation and blocks direct routes,
without business requests. Store discovery stays usable. Backend availability is separately
controlled by `REFERENCE_ENABLED`; keep the two settings consistent for a disabled installation.

### Demo tenant login

The standalone login screen is shown before login, including on bookmarked business routes.
Selecting a Tenant obtains a candidate demo token and loads only its Stores into the second dropdown.
Changing Tenant clears the Store selection, cancels its old discovery client and ignores late candidate
tokens. The candidate session is activated and stored only after selecting a valid Store and submitting
Sign in; no business requests run before this. Login opens Vehicles for the selected Store. RentalSofia owns all pre-tenant records.
Core issues an HMAC-SHA256 token containing Tenant ID and an eight-hour expiry. Both subgraphs
verify it per request and reject missing/invalid/expired sessions as UNAUTHENTICATED. Gateway
forwards Authorization; tenantId never comes from a business input or x-tenant-id header.

Core and Reference use the same DEMO_AUTH_SECRET (at least 32 characters). Their environment
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

### Angular Reference Vehicles

Routes are `/:language/stores/:storeId/reference/vehicles`, `/new` and `/:recordId/edit`.
Fields are required License Plate (32 characters) and optional multiline Notes (2000 characters).
Blank Notes clear to null. License Plate is not unique. Lists offer URL-backed search/sort/paging,
confirmed single/page-local sequential deletion, partial result feedback and failed-row retry.
Deleting an assigned Vehicle fails without deleting its Devices.

### Angular Reference Devices

Routes mirror Vehicles under `/reference/devices`. IMEI is a required string of exactly 15 digits,
unique within a Tenant/Store; leading zeros are preserved. Truck is a required same-tenant/same-store Vehicle selected
through a remote search/paging dialog. Several Devices may share a Truck. Create/update validates
assignment scope, and the database protects it with a composite foreign key.

Both modules use typed Reactive Forms, dirty guards, retained failed drafts and focused field errors.
Clients/caches belong to mounted session/Store/language views. Navigation cancels reads and stops unsent
batch deletes; submitted writes finish in their captured scope without obsolete UI callbacks.

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

## Admin translations

Bundled Bulgarian/English catalogs supply shell, forms, confirmations and startup text.
Document language follows the route. Apollo clients capture `Accept-Language`; submitted
writes keep their initiating session/Store/language. Record content/backend messages display as received.

## GraphQL and generation

SDL and named operation paths are explicit in `tools/graphql/contracts.mts`. Runtime Reference
loads Vehicle/Device SDL; Gateway loads the generated static supergraph. No database or running
backend is required for codegen/schema validation. Generated outputs stay ignored.

```bash
npm run codegen
npm run schema:check
```

Regenerate and restart after SDL/operation changes. Discover tenants through Gateway with `{ tenants { id name } }`, call `demoLogin(tenantId: "01000000-0000-4000-8000-000000000001") { token tenant { id name } }`, then send the returned token as `Authorization: Bearer <token>` for `{ stores { id name } }` and every business request. Business requests require `x-store-id`; the seeded Sofia Store is
`10000000-0000-4000-8000-000000000001`. For example:

```graphql
query VehiclesWithStores {
  referenceVehicles(offset: 0, limit: 20) {
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

Mutations are create/update/delete ReferenceVehicle and ReferenceDevice. Inputs never accept tenantId or storeId. [Architecture](architecture/overview.md#graphql-contracts-and-context) describes
validation, federation and error semantics. Inspect GraphQL errors even on HTTP 200 and
preserve the response request ID when reporting failures. Store scope is not authorization.

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

| Service   | Development database/role | Test database/role    | Environment variables                               |
| --------- | ------------------------- | --------------------- | --------------------------------------------------- |
| Core      | holita_core               | holita_core_test      | CORE_DATABASE_URL, CORE_TEST_DATABASE_URL           |
| Reference | holita_reference          | holita_reference_test | REFERENCE_DATABASE_URL, REFERENCE_TEST_DATABASE_URL |

Roles cannot connect to another service's databases or the corresponding dev/test database.
The [root environment example](../.env.example) configures POSTGRES_PORT/POSTGRES_PASSWORD.
If overriding the port, update application/test URLs too. Setup accepts only expected identities
on 127.0.0.1 at that port. Examples do not replace credentials in existing installations.
Compose project `holita` uses `holita_postgres_data` mounted at `/var/lib/postgresql`.
`db:down` preserves the volume. Do not delete volumes or reset databases to repair setup.

Core/Reference own their schemas, generated Prisma clients and reviewed SQL migrations. Tenant migrations assign existing rows to RentalSofia, preserve IDs/timestamps/relations and reconstruct tables transactionally to place tenantId after id. The Device FK includes Tenant/Store/Vehicle, and IMEI uniqueness includes Tenant/Store. `db:migrate` deploys Core then Reference; `db:generate`
generates both ignored clients. Later schema changes require new reviewed SQL migrations,
not edits to applied history or db push. `db:seed` inserts RentalSofia, two stable Stores, two Sofia Vehicles and one Device with a leading-zero IMEI. Existing keys and edits are preserved. Core runs before Reference; the stable reference fixtures belong to the seeded RentalSofia/Sofia Store.

## Troubleshooting

Use `nvm use` when node/npm are unavailable. Check Docker before `db:up`; setup and migration
are explicit prerequisites. Check application health endpoints and GraphQL errors separately.
A health response does not prove database readiness. Regenerate contracts and restart the group
when SDL/operations change. Check the selected Store and Reference startup/backend flags for
unavailable business screens. See [testing](testing.md) for guarded fixtures and cleanup.
