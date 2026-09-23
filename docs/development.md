# Local development

## Prerequisites and installation

Use the repository on the Ubuntu/WSL filesystem with Node.js 24.15+ and npm 11; the pinned
package manager is npm 11.19.0. With nvm available:

```bash
cd /var/workspace/services/ecomm
nvm use
npm ci
```

If Node 24 is not installed, run `nvm install` first. nvm is loaded by the shell; a bare
non-interactive WSL process may not have node/npm on PATH. Use a WSL terminal or initialize
nvm for that shell. Native Windows execution is not part of the verified setup.

## Commands

| Command                                           | Behavior                                                                                            |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| npm run dev                                       | Start all four applications with labelled logs; Ctrl+C stops the group                              |
| npm run dev:admin                                 | Vite development server                                                                             |
| npm run dev:gateway                               | Nest gateway watcher                                                                                |
| npm run dev:core                                  | Nest core watcher                                                                                   |
| npm run dev:products                              | Nest products watcher                                                                               |
| npm run projects                                  | List Nx application names                                                                           |
| npm run lint                                      | Lint source and root tooling, including application boundaries                                      |
| npm run typecheck                                 | Typecheck all four applications through Nx                                                          |
| npm run build                                     | Build all four applications through Nx                                                              |
| npm run format:check                              | Check formatting without rewriting files                                                            |
| npm run check:affected -- --base=BASE --head=HEAD | Lint/typecheck root tools; lint, typecheck and build affected projects using real commit references |

Backend builds produce apps/NAME/dist. After building, use
`npm run start:prod --workspace @holita/core` (or gateway/products) to run the emitted Node
entry point. Admin uses `npm run preview --workspace @holita/admin` to preview its build.

The [CI workflows](testing.md#github-actions) use the same commands on Ubuntu with Node
from .nvmrc and npm from package.json's packageManager field. PostgreSQL stays in Compose;
Node checks and test application processes run on the runner host. CI does not deploy.

## Ports and environment

| Application | Default         |
| ----------- | --------------- |
| gateway     | 127.0.0.1:11080 |
| admin       | 127.0.0.1:11081 |
| core        | 127.0.0.1:11082 |
| products    | 127.0.0.1:11083 |

Backend `.env.example` files document PORT. Copy only the example you need to that
application's `.env`; defaults work without any environment file. Core/products examples
also describe service-specific database URLs. Each backend starts
with its workspace as the current directory and reads that local environment file.
PORT must be an integer from 1 to 65535. An existing process environment takes precedence.

To override one backend without creating a file:

```bash
PORT=12082 npm run dev:core
```

For admin, Vite accepts an explicit port:

```bash
npm run dev --workspace @holita/admin -- --port 12081
```

`apps/admin/.env.example` documents VITE_GATEWAY_URL, defaulting to
http://127.0.0.1:11080/graphql. This is the admin's only business endpoint; it is a public
browser configuration value, never a place for credentials. Vite reads it at startup/build.
Use `VITE_GATEWAY_URL=http://127.0.0.1:12080/graphql npm run dev:admin` for a gateway override,
and align gateway ADMIN_ORIGIN with the exact browser origin when moving the admin port.

## Using Products

Open http://127.0.0.1:11081 and select a store. Seeded stores are holita Sofia and holita Plovdiv.
The header switcher stays available on list/create/edit screens. Store-scoped URLs can be
bookmarked or reloaded. Switching returns to the new store's list, resets pagination and
discards unsaved changes. A submitted operation retains its original store and may finish
after switching; return to that store to see the result.
Navigation between create/edit routes within the same store also starts a separate editor;
an earlier submitted write cannot redirect or overwrite the newly opened form.

The list uses server pagination (20 rows by default; choices 10, 20, 50, 100). Create/edit
share one form: name 1..200 and SKU 1..100 trimmed Unicode code points, case-sensitive SKU uniqueness
within a store, Draft default and Active option. Save disables the form while pending;
delete requires confirmation. Read failures offer Retry, and write failures preserve the
form for correction. There is no authentication, store administration or Dev Lab.

The backend GET /health response is `{ "status": "ok", "service": "core" }` (with the
corresponding service name). It requires no store header or database. Business operations
use /graphql. Health remains independent of PostgreSQL and other services.

## GraphQL and generation

| Command                                        | Behavior                                                                   |
| ---------------------------------------------- | -------------------------------------------------------------------------- |
| npm run schema:compose                         | Generate gateway supergraph and public schema from local SDL               |
| npm run codegen                                | Compose/validate contracts and generate each application's types/artifacts |
| npm run schema:check                           | Validate composition and all named operations, without writing artifacts   |
| npm run test:schema -- contracts.unit.spec.mts | Test real contracts and negative composition/operation cases offline       |

These commands need installed Node dependencies, not Docker, running subgraphs, a cloud
account or a schema registry. GraphQL Codegen v6 operation output uses its standalone
operations plugin; backend schema types use the TypeScript plugin. All generated output
lives under each application's ignored src/generated/graphql directory. Nx generation
targets explicitly include shared SDL, operation and tooling inputs. Nest copies GraphQL
assets into dist, so built applications do not read their source directories.

Root lint/typecheck/build/test and app dev/start commands generate their prerequisites.
After changing SDL or a named operation, run `npm run codegen`, then restart the Node
group. Asset watching is not dynamic schema composition. Keep PORT overrides aligned with
CORE_GRAPHQL_URL and PRODUCTS_GRAPHQL_URL in gateway; products also uses CORE_GRAPHQL_URL
for creation validation. URLs default to core 11082 and products 11083 on loopback.
Gateway ADMIN_ORIGIN defaults to http://127.0.0.1:11081 for browser CORS; update it if moving
admin. x-store-id and x-request-id are allowed headers; x-request-id is exposed in responses.

Use the gateway at http://127.0.0.1:11080/graphql. For store discovery, no headers are needed:

```graphql
query ListStores {
  stores {
    id
    name
  }
}
```

For product operations set `x-store-id` to one returned UUID. The seeded Sofia store is
`10000000-0000-4000-8000-000000000001`; Plovdiv ends in `0002`. A read including its actual
federated store:

```graphql
query ProductsWithStores {
  products(offset: 0, limit: 20) {
    items {
      id
      name
      sku
      status
      store {
        id
        name
      }
    }
    total
    offset
    limit
  }
}
```

Write operations are createProduct(input), updateProduct(id, input) and deleteProduct(id).
Creation requires name/SKU and defaults to DRAFT. Update accepts name, SKU and status;
at least one nonnull field is required. Neither input accepts storeId. See the
[contract behavior](architecture/overview.md#graphql-contracts-and-context) for limits,
error codes, unknown-store semantics and the core dependency on creation/federated fields.
Execution errors may use HTTP 200 with an errors array. Preserve x-request-id when reporting
a failure. Store context is not authentication or authorization.

## PostgreSQL and Prisma

Use Docker with Compose. Only PostgreSQL runs in a container; migrations, seeds and tests
run on the host. Run these commands from the repository root:

```bash
npm run db:up
npm run db:setup
npm run db:migrate
npm run db:seed
```

`db:up` waits for PostgreSQL health. `db:setup` creates development databases and roles;
`db:test:setup` separately creates test databases and roles. Both may be repeated: they
preserve data/passwords, verify existing owners/role privileges, and revoke PUBLIC access
to these four databases. They connect as the local `holita_admin` provisioning role, which
application URLs never use. They do not silently repair incompatible existing roles.

| Service  | Development database/role | Test database/role   | Environment variables                             |
| -------- | ------------------------- | -------------------- | ------------------------------------------------- |
| core     | holita_core               | holita_core_test     | CORE_DATABASE_URL, CORE_TEST_DATABASE_URL         |
| products | holita_products           | holita_products_test | PRODUCTS_DATABASE_URL, PRODUCTS_TEST_DATABASE_URL |

Every listed database is owned by its matching role. Roles cannot create databases or
roles, and cannot connect to the other service's databases or the corresponding dev/test
database. Test schemas are created within the owning test database.

Local URLs and example passwords are in [core's example](../apps/core/.env.example) and
[products' example](../apps/products/.env.example). The fixed instance is loopback port
11084 by default. [The root example](../.env.example) configures POSTGRES_PORT and
POSTGRES_PASSWORD for Compose/provisioning. If changing the port, also set the matching
application/test URLs. Provisioning accepts only the expected names on 127.0.0.1 at that
port. Existing environment variables take precedence over .env files. Setup reads root,
core and products .env files; app/Prisma commands read only their own workspace .env.
No old core-api environment is loaded or migrated automatically.

The Compose project is `holita`, with the persistent named volume `holita_postgres_data`.
The PostgreSQL 18 image mounts it at /var/lib/postgresql. `npm run db:down` removes the
container/network while preserving data. `npm run db:up` reuses the volume. Changing an
example password or POSTGRES_PASSWORD does not change passwords in an existing volume;
restore the correct configuration or deliberately manage credentials yourself. Never
use volume deletion or migrate reset to repair setup.

Each application owns prisma/schema.prisma, prisma.config.ts and prisma/migrations.
`npm run db:migrate` runs Prisma migrate deploy, core then products. Applied SQL migrations
are checked in and must not be edited. No shadow database or reset is required.
`npm run db:validate` validates both Prisma schemas; `npm run db:generate` generates both
clients without a running database. Clients in src/generated/prisma are ignored by Git
and generated before root lint/typecheck/build/test, independent core/products dev/start,
and seeds. Do not edit generated output.

To create a subsequent migration, edit the owning schema, use that workspace's Prisma
`migrate diff` to produce SQL from its current database to the schema, review and place
the SQL in a new timestamped migration directory, then deploy and run its focused DB
tests. Use the Prisma CLI's `--help` for the installed version. Do not apply schema
changes with db push in place of migration history.

Seeds run core before products and insert two stable stores (holita Sofia and holita Plovdiv),
then three products per store. IDs are fixed in each application's prisma/seed-data.ts.
`createMany` with skipDuplicates preserves existing IDs, edited rows and user-owned SKU
conflicts; repeated seeds insert only missing rows. A conflicting row means the matching
sample is skipped. Product fixtures repeat the two stable store IDs explicitly;
standalone product seeding assumes core was seeded first. There is no cross-database
foreign key or network call in this administrative seed command.

## Existing installations with legacy resource names

The product and resources use holita. `red.bg` is only the temporary service domain.
An installation created with the former `red-bg` Compose project needs an explicit data
transition: changing the project name alone attaches a different, empty volume.

Stop the old application's writers before the final backup. Keep the old PostgreSQL
volume and restricted logical backups for rollback. For each service, use PostgreSQL's
`pg_dump --format=custom --no-owner --no-privileges` and restore into its new database
with `pg_restore --no-owner --no-privileges --role=<new-owner> --exit-on-error`. Restore
only into a deliberately provisioned empty destination; never reset an existing database.

| Legacy database/role | Current database/role |
| -------------------- | --------------------- |
| red_core             | holita_core           |
| red_products         | holita_products       |
| red_core_test        | holita_core_test      |
| red_products_test    | holita_products_test  |

The provisioning role changes from red_admin to holita_admin. Preserve its password
and each service role's password/privileges; provision destination roles before restore.
Retain existing credentials in ignored root/application `.env` files, using the new role
and database names in connection URLs. Fresh-install example passwords do not replace
credentials in an existing installation. Backup files containing role credentials must
remain private and must never be committed or printed in diagnostics.

Before switching connections, compare every row, UUID, timestamp, database object,
constraint, owner, access privilege and `_prisma_migrations` record. Verify restored
credentials and service/test role isolation. Repeat migrate/seed and restart PostgreSQL
to confirm preservation. Existing store names and user edits remain unchanged; holita
fixture labels apply only when seeds insert missing stores. Historical local logs and
the original brief retain their original names.

## Dependency compatibility and advisory status

The lockfile applies narrowly scoped overrides while the owning dependencies still
request vulnerable versions:

| Consumer                                                   | Override           | Purpose                                                   |
| ---------------------------------------------------------- | ------------------ | --------------------------------------------------------- |
| nx                                                         | smol-toml 1.9.0    | Patched 1.x TOML parsing                                  |
| @prisma/config                                             | deepmerge-ts 8.0.2 | Patched recursive merging; exercised by Prisma config/CLI |
| @apollo/federation-internals, @apollo/query-graphs, gaxios | uuid 11.1.1        | Patched version retaining CommonJS support                |

Review these overrides when updating their parent packages. Preserve the npm-generated
lockfile and validate generation, schemas, migrations/seeds and federation after changes.
Do not use `npm audit fix --force` as a substitute for compatibility testing.

Apollo Gateway's transitive OpenTelemetry 1.x tree still carries
[GHSA-8988-4f7v-96qf](https://github.com/advisories/GHSA-8988-4f7v-96qf).
The patched core begins at 2.8.0, but a core-only override removes APIs used by the 1.x
SDKs. Updating the whole family also removes Resource/Sync detector APIs used by Apollo;
see the [upstream 2.x migration guide](https://github.com/open-telemetry/opentelemetry-js/blob/main/doc/upgrade-to-2.x.md).

The current gateway disables Apollo anonymous metrics and configures no inbound baggage
propagator. Node's normal 16 KiB total HTTP-header limit bounds incoming requests, as
described in the advisory's workaround. Gateway bootstrap and real federation tests
verify rejection of an oversized baggage header before subgraph calls. This mitigates
the HTTP entry point; it does not patch the installed library or make the audit clean.
Raising header limits, enabling telemetry propagation, or adding a non-HTTP transport
requires reassessing this finding. The foundation is local development without auth;
this is not a production security acceptance.

## Troubleshooting

- Missing executable or dependency: initialize Node/npm and run `npm ci` from the root.
- Database connection refused: run `npm run db:up`; check port and service-specific URLs.
- Missing database/role: run `db:setup` for development or `db:test:setup` for tests.
- Missing table: run `db:migrate` for development. DB tests deploy into their own schemas.
- Missing/stale GraphQL artifact: run `npm run codegen` and restart the affected apps.
- SERVICE_UNAVAILABLE during creation: check core and products' CORE_GRAPHQL_URL. No product
  is inserted when existence validation fails. A query selecting Product.store also needs core.
- BAD_USER_INPUT for x-store-id: pass a store UUID as one header. Store listing needs no
  selected store. A valid unknown store has an empty product list; creation returns NOT_FOUND.
- Unexpected existing database owner, role privileges or password: inspect configuration;
  setup intentionally refuses to overwrite credentials/ownership or erase data.
- Busy port: stop the process you own or explicitly choose another port. Vite strictPort
  avoids silently moving the admin; Nest reports its listen error.
- Invalid PORT: correct the application .env/process environment and restart the process.
- No tests found: see [testing](testing.md); this is not a successful check.
- Missing affected base: use a real local commit or fetch the intended base yourself;
  do not assume origin/main exists. `--base=HEAD` compares local work against the current
  commit, including untracked source files, rather than an entire PR.
- After Ctrl+C, verify the task's ports are released before starting another copy.
