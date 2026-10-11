# Stores foundation

This document covers the implemented Tenant/Store foundation for the online-store domain.
Core currently also supplies Store discovery to Discocan, where it is used as organizational
scope and will later become [Branches](../discocan/README.md#terminology).

## Persistence and ownership

Core owns Tenant and Store in its own PostgreSQL database, Prisma schema, client and SQL migrations.
Tenant has a UUID, unique Name up to 200 characters and timestamps. Store has a UUID, mandatory
tenantId, Name up to 200 characters and timestamps. The Tenant foreign key restricts deletion/update;
Store's composite `(tenantId, id)` key supports tenant-scoped lookup. In PostgreSQL, tenantId is
physically second after id. Store access always uses the verified Tenant; direct SQL access by
the owning role is not tenant-isolated through RLS.

FND-004: Core discovers/looks up Stores. Seeds insert RentalSofia and stable Discordia/Sandbox
Stores without modifying existing rows. Fleet sample records are documented in
[Discocan requirements](../discocan/requirements.md).

## GraphQL contracts

[Core SDL](../../apps/core/src/stores/stores.graphql) exposes `Store { id name }`,
`stores` and `store(id: ID!)` through Gateway federation. Authenticated Store discovery needs
no `x-store-id` header. Every Store query and federation reference resolves within the verified
Tenant; a missing or foreign Store lookup returns null. List order is Name then ID.
There are no Store create/update/delete mutations or Store business editor.

Public `tenants` and `demoLogin(tenantId: ID!)` support the current development-only demo session.
The token is sent as `Authorization: Bearer <token>` for `{ stores { id name } }` or
`{ store(id: "10000000-0000-4000-8000-000000000001") { id name } }`.
The demo flow allows anyone to select any Tenant; it is not production authentication or
tenant membership authorization. The current Angular login and session lifecycle are described
in [Discocan development](../discocan/development.md#demo-tenant-login).

## Implementation references

- [Prisma schema](../../apps/core/prisma/schema.prisma).
- [Resolver](../../apps/core/src/stores/stores.resolver.ts).
- [Service](../../apps/core/src/stores/stores.service.ts).
- [Repository](../../apps/core/src/stores/stores.repository.ts).

The resolver delegates to the concrete service/repository. Store IDs are validated as UUIDs;
Tenant identity comes from the verified session, never a caller-supplied tenant header/input.
Fleet validates Store existence through Core only on business creation. Its consumer rules
are covered by [Discocan architecture](../discocan/architecture.md).

## Validation

Use [shared database prerequisites and guarded fixtures](../testing.md#real-postgresql-checks).

```bash
npm run test:core -- demo-auth.spec.ts --skip-nx-cache
npm run test:core:db -- stores.db.spec.ts persistence.db.spec.ts initial-migration.db.spec.ts
```

Changes to the Store federation contract or the current telemetry consumer also need the
relevant [Discocan checks](../discocan/testing.md) and real federation validation from
[the shared guide](../testing.md#real-federation-and-browser-smoke-checks).
