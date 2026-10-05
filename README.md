# holita

holita is a working reference project created as a testbed for future software development
life cycle (SDLC) automation.

A strict TypeScript npm-workspaces repository with Nx tasks and six host applications:
Angular admin, React/Vite admin-react and NestJS gateway, core, products and reference services.
Angular provides a minimal Hello world, store selection and Products read through the real gateway.
The React admin remains the CRUD and behavior reference. It uses
an Aurora/MUI shell with a single-column sidenav, no footer and Products/Venues/Speakers/Tags/Events screens with Refine.
Sessions, Gallery, History and store-selection states use the same Aurora theme. The gateway exposes schema-first GraphQL for stores and store-scoped
Products CRUD, including Product-to-Store federation. Core, products and reference own independent
PostgreSQL databases, Prisma migrations, clients and repeatable seeds. All backends expose
`GET /health`.

## Run locally

Use Ubuntu/WSL with Node.js 24.15 or newer and npm 11. The lockfile uses npm 11.19.0.
From the repository root:

```bash
nvm use
npm ci
```

If Node 24 is not installed yet, run `nvm install` before `nvm use`.

### Angular admin

Prepare the databases and start the applications with the commands below. Open
[Angular admin](http://127.0.0.1:11088). It discovers stores through the real gateway and
reads the selected store's first 20 products with generated GraphQL types and Apollo Angular.
Bulgarian/English routes preserve the selected store across reloads. Each mounted Products
workspace owns a separate Apollo client/cache; switching stores discards that workspace.

`npm run dev:admin` starts Angular alone when the backends are already running.
This foundation has native HTML presentation, no Sakai/PrimeNG shell, CRUD forms or
Prototype mode. See [configuration](docs/development.md#angular-admin-foundation) and
[validation](docs/testing.md#angular-admin-checks).

### React Prototype only

```bash
npm run dev:admin-react:mock
```

Open [Prototype admin](http://127.0.0.1:11087), check the **Prototype** mode indicator and
choose a store. No Docker, database, backend or copied `.env` file is needed. Ctrl+C stops
this admin process. `npm run dev:admin-react` starts Real; use `dev:admin-react:mock` for Prototype.
See [the manual review steps](docs/development.md#manual-prototype-review) and
[Prototype tests](docs/testing.md#prototype-checks).

### All applications together

Prepare the databases, then start Angular, both admin-react modes and the backends:

```bash
npm run db:up
npm run db:setup
npm run db:migrate
npm run db:seed
npm run dev
```

Open [Real admin](http://127.0.0.1:11081) or [Prototype admin](http://127.0.0.1:11087). Gateway, core, products and reference listen on
127.0.0.1 ports 11080, 11082, 11083 and 11086 respectively. All processes run on the host;
PostgreSQL alone runs in Docker on 127.0.0.1:11084. Ctrl+C stops the Node group;
`npm run db:down` separately stops PostgreSQL and preserves its volume. Database setup,
migrations and seeds are explicit commands, never side effects of `dev`.

Prototype provides store discovery and the same Products, Venues, Speakers, Tags, Events and Sessions
screens, including Event status actions, Trash/Restore and History, with browser-persisted
fixtures and confirmed Reset demo data. Gallery uploads, cover, alt text and ordering use
the same screens, with uploaded files in browser IndexedDB. Its **Prototype → UI catalog**
menu opens interactive body, list, form and feedback examples after store selection;
catalog edits are temporary and do not change saved mock records. Real uses the
gateway; `npm run dev:admin-react` / `dev:admin-react:graphql` starts it alone. `npm run dev` starts Angular and both
React admin modes alongside the four backends. See [data modes and current limits](docs/development.md#admin-data-modes).

Fresh seeds provide holita Sofia and holita Plovdiv; migrated installations retain their
existing store names. Select a store, then list, create, edit or delete products. The store
switcher stays available on every screen; URLs preserve the selection across reloads. Switching stores
returns to that store's current resource list; Products and Reference ask before discarding unsaved forms. A submitted write still
belongs to its initiating store; its late result does not redirect or notify in another store.

Choose **Reference → Events, Venues, Speakers or Tags** to manage the demo domain. Events
have three form tabs, remote Venue/Tag selectors, exact EUR budgets and Sofia event times.
Their list supports server filtering/sorting, URL-persisted navigation and per-store column
preferences. Event rows open the editor; **View** in the row menu opens saved details and quick actions. The Sessions
tab manages the event program, speaker assignments and explicit drag/button ordering with
Save order and Cancel order. Session times must fit the Event. Active/Trash tabs support
restore while preserving status, sessions and images. Select the current page's rows for
confirmed Publish/Archive/Trash/Restore; each batch succeeds or fails as a whole. The History
tab shows saved changes and before/after excerpts with anonymous attribution.
**Edit event → Content & media** includes the rich description and, after the first save, an
image gallery with upload progress, cover, alt text and ordering. Gallery actions save
separately; the overview displays the saved images. Real stores files privately in the
Reference service; Prototype uses browser IndexedDB. No AWS setup is needed.
See [media setup and limits](docs/development.md#using-reference).
Reference forms warn about unsaved changes; validation errors open the relevant tab. `REFERENCE_ENABLED=false` disables its backend
operations; `VITE_REFERENCE_ENABLED=false` hides its navigation and blocks direct admin
routes after restarting/rebuilding the admin. Both default to true for local use. Source,
existing data and the static schema remain available when disabled.

Use the [Reference implementation index](docs/reference.md) to find the code and focused tests
for each pattern. On narrow screens, **Open navigation** opens the menu and the store
selector and Prototype/Real indicator appear below the top bar. Desktop navigation shows all
enabled groups together and supports collapse through the top-bar button.
The top bar provides local module search, example notifications/profile, a Bulgarian/English language
selector and Aurora theme/color preferences. Search only finds enabled navigation entries;
notifications and profile actions are examples, with no account or notification service.
Appearance preferences persist locally. Products, Venues, Speakers and Tags follow the selected Aurora preset
and provide search, automatic filters, server sorting, page-local batch deletion and responsive
forms with a status/summary panel. Referenced venues, speakers and tags remain protected from deletion.
Events use the same Aurora components for their list, editor and overview, with automatic filters
and a sticky settings/summary aside. Session editors reuse that composition; ordered sessions,
Gallery previews/actions and expandable History follow the same light/dark Aurora preset.

The React admin uses `/bg/...` and `/en/...` routes, adding `bg` when the URL has no language.
The language menu preserves the current path and query, and GraphQL requests send
`Accept-Language`. React and Refine share bundled catalogs with English fallback. Products,
Reference, the shell/store states, shared confirmations/actions and Prototype controls/catalog
use translations in both data modes. MUI/Data Grid text and display dates/numbers follow the
language; event times remain in Europe/Sofia and budgets in EUR. See
[admin translations](docs/development.md#admin-translations) for the mechanism and current limits.

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
npm run dev:admin-react
npm run dev:gateway
npm run dev:core
npm run dev:products
npm run dev:reference
```

## Check a change

For a quick Prototype check after installation, run from the repository root:

```bash
npm run test:admin-react -- prototype.test.ts prototype-controls.test.tsx --skip-nx-cache
npm exec -- playwright install --with-deps chromium
npm run test:smoke:admin-react -- prototype.smoke.spec.mts --grep="Prototype uses the same Tags screens"
```

Install Chromium once; its Linux system dependencies may require sudo. These selected
tests need no backend or database and start their own isolated Prototype browser instance.
See [Prototype checks](docs/testing.md#prototype-checks) for capability-specific files,
the complete Prototype browser selection and failure diagnostics.

For backend and Real checks, select the relevant commands from:

```bash
npm run test:products -- health.spec.ts
npm run test:products -- products.service.spec.ts
npm run db:test:setup
npm run test:products:db -- products.db.spec.ts
npm run test:gateway:db -- federation.db.spec.mts
npm run test:admin -- --include=app/features/products/products-api.spec.ts --skip-nx-cache
npm run test:smoke:admin -- angular-foundation.smoke.spec.mts
npm run test:admin-react -- product-form.test.tsx
npm run test:admin-react -- store-workspace.test.tsx
npm run lint
npm run typecheck
npm run build
```

Use [the testing guide](docs/testing.md) to choose relevant files/cases. Full regression
is a separate, explicit command and is not part of normal development.
The [PR workflow](.github/workflows/affected.yml) checks affected applications against the
PR's actual base/head, including each affected admin's browser smoke target.
The [full regression workflow](.github/workflows/full-regression.yml) runs only through
GitHub Actions' manual Run workflow action. See [CI behavior](docs/testing.md#github-actions)
for selection, prerequisites and missing-history handling.
Database tests use dedicated credentials and a fresh schema per run, never development
data. Default local configuration works without copying environment files.

For the small real-browser check, install Chromium once with
`npm exec -- playwright install --with-deps chromium`, then run
`npm run test:smoke:admin-react -- products.smoke.spec.mts`. PostgreSQL and provisioned test databases
are required; the fixture owns its temporary schemas and application processes.

See [docs/README.md](docs/README.md) for configuration, architecture, requirements and
contributor guidance.
