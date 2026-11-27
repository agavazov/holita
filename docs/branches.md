# Branches foundation

This document covers the implemented, shared Core Tenant/Branch foundation.
A Branch represents an online shop in Ecommerce and a vehicle fleet in
[Discocan](../discocan/docs/README.md#terminology). Both domains use the same model and contracts.

## Persistence and ownership

Core owns Tenant and Branch in its own PostgreSQL database, Prisma schema, client and SQL migrations.
Tenant has a UUID, unique Name up to 200 characters and timestamps. Branch has a UUID, mandatory
tenantId, Name up to 200 characters and timestamps. The rename API accepts 1–80 Unicode code
points after trimming; existing longer names remain readable. The Tenant foreign key restricts deletion/update;
Branch's composite `(tenantId, id)` key supports tenant-scoped lookup. In PostgreSQL, tenantId is
physically second after id. Branch access always uses the verified Tenant; direct SQL access by
the owning role is not tenant-isolated through RLS.

FND-004: Core discovers/looks up Branches and renames the selected Branch. Seeds insert RentalSofia and stable Discordia/Sandbox
Branches without modifying existing rows. Fleet sample records are documented in
[Discocan requirements](../discocan/docs/requirements.md).

## GraphQL contracts

[Core SDL](../osnova/apps/core/src/modules/branches/branches.graphql) exposes `Branch { id name }`,
`branches` and `branch(id: ID!)` through Gateway federation. Authenticated Branch discovery needs
no `x-branch-id` header. Every Branch query and federation reference resolves within the verified
Tenant; a missing or foreign Branch lookup returns null. List order is Name then ID.
`updateBranchName(id: ID!, name: String!): Branch!` changes only the selected Branch's name.
It requires a verified Tenant and a valid `x-branch-id` UUID matching `id`; missing, malformed or
mismatched selection is BAD_USER_INPUT. Names are trimmed, required, at most 80 Unicode code
points and cannot contain NUL. Invalid names return BAD_USER_INPUT with a sanitized
`fieldErrors` entry whose path is `name`. A missing or foreign scoped mutation target is
NOT_FOUND. The update preserves the Branch ID, Tenant and creation time, so existing Fleet
references and insert-only seeds keep their identity. Discovery and federation resolve the
persisted new name. There are no Branch create/delete mutations.

Public `tenants` and `demoLogin(tenantId: ID!)` support the current development-only demo session.
Their SDL belongs to [Tenants](../osnova/apps/core/src/modules/tenants/tenants.graphql), while
Branch queries and federation definitions belong to the Branch module. Core loads both
files explicitly into the same subgraph. Both feature repositories use the Core-local
[DatabaseModule](../osnova/apps/core/src/database/database.module.ts) and its single Prisma client.
The token is sent as `Authorization: Bearer <token>` for `{ branches { id name } }` or
`{ branch(id: "10000000-0000-4000-8000-000000000001") { id name } }`.
Renaming also sends `x-branch-id` with the same Branch UUID as the mutation's `id` argument.
The demo flow allows anyone to select any Tenant; it is not production authentication or
tenant membership authorization. The current Angular login and session lifecycle are described
in [Discocan development](../discocan/docs/development.md#demo-tenant-login).

## Platform administration and suspension

Core stores one optional PLATFORM Tenant and CUSTOMER Tenants. Tenant and Branch status is ACTIVE
by default and can be SUSPENDED. Suspended Tenants cannot sign in and their sessions fail Core
verification; suspended Branches are excluded from discovery and lookup. Demo Tenant discovery
also excludes suspended and platform Tenants.

Verified platform ADMINISTRATOR, OPERATOR, and SALES sessions can query `merchants` and `merchant`.
`merchants(offset, limit)` returns a page of identities, statuses and Branch counts, ordered by
name and ID, with a total. The default offset is 0 and the default limit is 20. Limits range from
1 to 100. `merchant(tenantId)` returns the selected CUSTOMER Tenant and its Branches, including
their statuses, or null when the merchant is missing.

Platform ADMINISTRATOR and OPERATOR sessions can call `createMerchant`, `createMerchantBranch`,
`setMerchantStatus`, and `setMerchantBranchStatus`. `createMerchant` creates its first administrator
in the same transaction. CUSTOMER sessions cannot use the platform reads or writes. `createUser`
and user setup permit SALES only within the platform Tenant.

## Implementation references

- [Prisma schema](../osnova/apps/core/prisma/schema.prisma).
- [Resolver](../osnova/apps/core/src/modules/branches/branches.resolver.ts).
- [Service](../osnova/apps/core/src/modules/branches/branches.service.ts).
- [Repository](../osnova/apps/core/src/modules/branches/branches.repository.ts).

The resolver delegates to the concrete service/repository. Branch IDs are validated as UUIDs;
Tenant identity comes from the verified session, never a caller-supplied tenant header/input.
Fleet validates Branch existence through Core on business creation and settings upserts. Its consumer rules
are covered by [Discocan architecture](../discocan/docs/architecture.md).

## Validation

Use [shared database prerequisites and guarded fixtures](testing.md#real-postgresql-checks).

```bash
npm run test:core
npm run test:core:db
```

For shared Branch API changes, check the Discocan and Holita domain documents and select validation
for the affected behavior. Changes to the Branch federation contract or the current telemetry consumer also need the
[federation check](testing.md#federation).
