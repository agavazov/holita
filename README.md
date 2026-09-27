# holita

holita is a working reference project created as a testbed for future software development
life cycle (SDLC) automation.

A strict TypeScript npm-workspaces repository with Nx tasks and five host applications:
React/Vite admin and NestJS gateway, core, products and reference services. The admin uses Refine and
Ant Design for store selection, Products management and Reference Event Management. The gateway exposes schema-first GraphQL for stores and store-scoped
Products CRUD, including Product-to-Store federation. Core, products and reference own independent
PostgreSQL databases, Prisma migrations, clients and repeatable seeds. All backends expose
`GET /health`.

## Run locally

Use Ubuntu/WSL with Node.js 24.15 or newer and npm 11. The lockfile uses npm 11.19.0.
From the repository root:

```bash
nvm use
npm ci
npm run db:up
npm run db:setup
npm run db:migrate
npm run db:seed
npm run dev
```

Open [the admin](http://127.0.0.1:11081). Gateway, core, products and reference listen on
127.0.0.1 ports 11080, 11082, 11083 and 11086 respectively. All processes run on the host;
PostgreSQL alone runs in Docker on 127.0.0.1:11084. Ctrl+C stops the Node group;
`npm run db:down` separately stops PostgreSQL and preserves its volume. Database setup,
migrations and seeds are explicit commands, never side effects of `dev`.

Fresh seeds provide holita Sofia and holita Plovdiv; migrated installations retain their
existing store names. Select a store, then list, create, edit or delete products. The store
switcher stays in the header; URLs preserve the selection across reloads. Switching stores
returns to that store's current resource list; Reference asks before discarding unsaved forms. A submitted write still
belongs to its initiating store; its late result does not redirect or notify in another store.

Choose **Reference → Events, Venues, Speakers or Tags** to manage the demo domain. Events
have three form tabs, remote Venue/Tag selectors, exact EUR budgets and Sofia event times.
Their list supports server filtering/sorting, URL-persisted navigation and per-store column
preferences. Event titles open an overview with saved details and quick actions. The Sessions
tab manages the event program, speaker assignments and explicit drag/button ordering with
Save order and Cancel order. Session times must fit the Event. Active/Trash tabs support
restore while preserving status, sessions and images. Select the current page's rows for
confirmed Publish/Archive/Trash/Restore; each batch succeeds or fails as a whole. The History
tab shows saved changes and before/after excerpts with anonymous attribution.
**Edit event → Content & media** includes the rich description and, after the first save, an
image gallery with upload progress, cover, alt text and ordering. Gallery actions save
separately; the overview displays the saved images. Files use private local storage; no
AWS setup is needed. See [media setup and limits](docs/development.md#using-reference).
Reference forms warn about unsaved changes; validation errors open the relevant tab. `REFERENCE_ENABLED=false` disables its backend
operations; `VITE_REFERENCE_ENABLED=false` hides its navigation and blocks direct admin
routes after restarting/rebuilding the admin. Both default to true for local use. Source,
existing data and the static schema remain available when disabled.

Use the [Reference implementation index](docs/reference.md) to find the code and focused tests
for each pattern. On narrow screens, **Menu** opens navigation and the header tabs wrap
inside their card.

Use [gateway GraphQL](http://127.0.0.1:11080/graphql) for API operations. `{ stores { id name } }`
works without a selected store. Product and Reference operations require an `x-store-id` UUID header;
for the seeded Sofia store use `10000000-0000-4000-8000-000000000001`. Store context scopes
data; this local foundation has no authentication or authorization.

SDL and named operations generate types and the static supergraph locally before dependent
startup/build commands. After editing SDL or operations, run `npm run codegen` and restart
the Node group. `npm run schema:check` needs no running services or database.

Each application also starts independently:

```bash
npm run dev:admin
npm run dev:gateway
npm run dev:core
npm run dev:products
npm run dev:reference
```

## Check a change

```bash
npm run test:products -- health.spec.ts
npm run test:products -- products.service.spec.ts
npm run db:test:setup
npm run test:products:db -- products.db.spec.ts
npm run test:gateway:db -- federation.db.spec.mts
npm run test:admin -- product-form.test.tsx
npm run test:admin -- store-workspace.test.tsx
npm run lint
npm run typecheck
npm run build
```

Use [the testing guide](docs/testing.md) to choose relevant files/cases. Full regression
is a separate, explicit command and is not part of normal development.
The [PR workflow](.github/workflows/affected.yml) checks affected applications against the
PR's actual base/head, including the browser smoke target when admin is affected.
The [full regression workflow](.github/workflows/full-regression.yml) runs only through
GitHub Actions' manual Run workflow action. See [CI behavior](docs/testing.md#github-actions)
for selection, prerequisites and missing-history handling.
Database tests use dedicated credentials and a fresh schema per run, never development
data. Default local configuration works without copying environment files.

For the small real-browser check, install Chromium once with
`npm exec -- playwright install --with-deps chromium`, then run
`npm run test:smoke -- products.smoke.spec.mts`. PostgreSQL and provisioned test databases
are required; the fixture owns its temporary schemas and application processes.

See [docs/README.md](docs/README.md) for configuration, architecture, requirements and
contributor guidance.
