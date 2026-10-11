# holita

holita is a working reference project created as a testbed for future software development
life cycle (SDLC) automation.

A strict TypeScript npm-workspaces repository with Nx tasks and five host applications:
Angular admin and NestJS gateway, core, products and reference services.
Sakai is the theme and visual reference for the Angular admin in `apps/admin`, with holita
branding and PrimeNG components. Angular provides store selection, Products and Reference Venues/Speakers/Tags/Vehicles/Devices CRUD plus Events list/editor/overview, atomic lifecycle actions, History and Event-scoped Sessions through
the real gateway. The pinned, ignored [Sakai source](docs/development.md#sakai-source-reference)
supplies the shell and feature presentation reference.
The gateway exposes schema-first GraphQL for stores and store-scoped
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
[Angular admin](http://127.0.0.1:11000). It discovers stores through the real gateway and
reads a server-paginated Products list with search, SKU/status filters and sorting through
generated GraphQL types and Apollo Angular. Bulgarian/English routes preserve the selected
store and list query across reloads. Each mounted Products or Reference
workspace owns a separate Apollo client/cache; switching stores discards that workspace.
Products can be created and edited through typed Reactive Forms with validation, unsaved-change
confirmation and callbacks scoped to the current editor. Submitted writes settle in their original store.
Single and page-local batch deletion require confirmation, report partial failures and retain
failed rows for retry. Navigation stops unsent deletes while the submitted write settles.

**Reference → Venues** provides server-paginated name/activity filters and sorting, a typed
location/settings editor, optional nullable fields and permanent deletion with referenced-row
errors and failed-row retry. The optional startup `referenceEnabled` flag hides and blocks
Reference when false; Products stays available. **Reference → Speakers and Tags** adds typed
editors, nullable email/biography clearing, live HEX color preview and duplicate Tag name errors.
All three lists preserve URL paging, name/activity filters and sorting; referenced records remain
protected from deletion, including relations retained through trashed Events.

**Reference → Vehicles** provides License Plate (required) and Notes (optional textarea),
with search, sorting, paging, creation/editing and confirmed deletion. It uses store-isolated data and Bulgarian/English labels.

**Reference → Events** provides server filters/ranges/sorting, per-store columns, a typed
General/Schedule/Content editor, remote Venue/Tag selection and saved overview. EUR budgets
remain exact strings; times use Europe/Sofia. Rich text supports safe formatting/web links
and a 100 KiB UTF-8 limit. Create opens the saved editor; editing opens the overview.
Event page-local selections support confirmed atomic Publish/Archive/Trash/Restore. Trash has a read-only overview and retains the reserved Code and children; History is paginated with localized labels and plain-text description excerpts. The Sessions tab provides typed child CRUD, remote Speakers, drag/keyboard ordering with separate Save/Cancel and a unique Speaker summary. Times use Europe/Sofia and stay within the saved Event; rejected order drafts survive until reloaded. The saved editor adds direct image uploads, cover/alt text, confirmed removal and explicit Gallery ordering; the overview provides previews. Gallery writes preserve unsaved Event fields.

`npm run dev:admin` starts Angular alone when the backends are already running.
The shell supports desktop/mobile navigation, Bulgarian/English and persisted light/dark themes.

### All applications together

Prepare the databases once, then start Angular and the four backends:

```bash
npm run db:up
npm run db:setup
npm run db:migrate
npm run db:seed
npm run dev
```

Open [Angular admin](http://127.0.0.1:11000).
Gateway, core, products and reference listen on
127.0.0.1 ports 11010, 11011, 11012 and 11013 respectively. All processes run on the host;
PostgreSQL alone runs in Docker on 127.0.0.1:11084. Each `npm run dev` starts PostgreSQL
through `db:up` and waits for it to become healthy before starting the applications.
Docker must be running. Ctrl+C stops the Node group;
`npm run db:down` separately stops PostgreSQL and preserves its volume. Database setup,
migrations and seeds are explicit commands, never side effects of `dev`.

### Gateway and backend services

Use [gateway GraphQL](http://127.0.0.1:11010/graphql) for API operations. `{ stores { id name } }`
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

Select the relevant commands from:

```bash
npm run test:products -- health.spec.ts
npm run test:products -- products.service.spec.ts
npm run db:test:setup
npm run test:products:db -- products.db.spec.ts
npm run test:gateway:db -- federation.db.spec.mts
npm run test:admin -- --include=app/features/products/products-api.spec.ts --skip-nx-cache
npm run test:smoke:admin -- angular-foundation.smoke.spec.mts
npm run lint
npm run typecheck
npm run build
```

Use [the testing guide](docs/testing.md) to choose relevant files/cases. Full regression
is a separate, explicit command and is not part of normal development.
The [PR workflow](.github/workflows/affected.yml) checks affected applications against the
PR's actual base/head, including the affected admin's browser smoke target.
The [full regression workflow](.github/workflows/full-regression.yml) runs only through
GitHub Actions' manual Run workflow action. See [CI behavior](docs/testing.md#github-actions)
for selection, prerequisites and missing-history handling.
Database tests use dedicated credentials and a fresh schema per run, never development
data. Default local configuration works without copying environment files.

For the small real-browser check, install Chromium once with
`npm exec -- playwright install --with-deps chromium`, then run
`npm run test:smoke:admin -- angular-foundation.smoke.spec.mts`. PostgreSQL and provisioned test databases
are required; the fixture owns its temporary schemas and application processes.

See [docs/README.md](docs/README.md) for configuration, architecture, requirements and
contributor guidance.
