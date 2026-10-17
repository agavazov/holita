# Branches foundation

This document covers the implemented, shared Core Tenant/Branch foundation.
A Branch represents an online shop in Ecommerce and a vehicle fleet in
[Discocan](../discocan/README.md#terminology). Both domains use the same model and contracts.

## Persistence and ownership

Core owns Tenant and Branch in its own PostgreSQL database, Prisma schema, client and SQL migrations.
Tenant has a UUID, unique Name up to 200 characters and timestamps. Branch has a UUID, mandatory
tenantId, Name up to 200 characters and timestamps. The Tenant foreign key restricts deletion/update;
Branch's composite `(tenantId, id)` key supports tenant-scoped lookup. In PostgreSQL, tenantId is
physically second after id. Branch access always uses the verified Tenant; direct SQL access by
the owning role is not tenant-isolated through RLS.

FND-004: Core discovers/looks up Branches. Seeds insert RentalSofia and stable Discordia/Sandbox
Branches without modifying existing rows. Fleet sample records are documented in
[Discocan requirements](../discocan/requirements.md).

## GraphQL contracts

[Core SDL](../../apps/core/src/branches/branches.graphql) exposes `Branch { id name }`,
`branches` and `branch(id: ID!)` through Gateway federation. Authenticated Branch discovery needs
no `x-branch-id` header. Every Branch query and federation reference resolves within the verified
Tenant; a missing or foreign Branch lookup returns null. List order is Name then ID.
There are no Branch create/update/delete mutations or Branch business editor.

Public `tenants` and `demoLogin(tenantId: ID!)` support the current development-only demo session.
The token is sent as `Authorization: Bearer <token>` for `{ branches { id name } }` or
`{ branch(id: "10000000-0000-4000-8000-000000000001") { id name } }`.
The demo flow allows anyone to select any Tenant; it is not production authentication or
tenant membership authorization. The current Angular login and session lifecycle are described
in [Discocan development](../discocan/development.md#demo-tenant-login).

## Implementation references

- [Prisma schema](../../apps/core/prisma/schema.prisma).
- [Resolver](../../apps/core/src/branches/branches.resolver.ts).
- [Service](../../apps/core/src/branches/branches.service.ts).
- [Repository](../../apps/core/src/branches/branches.repository.ts).

The resolver delegates to the concrete service/repository. Branch IDs are validated as UUIDs;
Tenant identity comes from the verified session, never a caller-supplied tenant header/input.
Fleet validates Branch existence through Core only on business creation. Its consumer rules
are covered by [Discocan architecture](../discocan/architecture.md).

## Validation

Use [shared database prerequisites and guarded fixtures](../testing.md#real-postgresql-checks).

```bash
npm run test:core -- demo-auth.spec.ts --skip-nx-cache
npm run test:core:db -- branches.db.spec.ts persistence.db.spec.ts initial-migration.db.spec.ts branch-migration.db.spec.ts
```

Changes to the Branch federation contract or the current telemetry consumer also need the
relevant [Discocan checks](../discocan/testing.md) and real federation validation from
[the shared guide](../testing.md#real-federation-and-browser-smoke-checks).
