# 131 Establish the Sales subgraph

**Status:** Ready. **Product:** Holita.

## Background

Sales currently shares the operator shell and Core merchant directory with Backoffice. CRM needs
durable team records before a merchant or Branch exists. Core owns accounts, Tenants and Branches.
Commerce requires a verified merchant and shop for operator data, so it cannot own prospect
records without weakening that boundary. The Angular application and shared operator package
have no persistence boundary. red.bg already keeps CRM and booking state in Sales and references
Core records by ID. Wave 4 adds CRM to the earlier shop-first migration scope.

## Goal

Give Holita an operator-only Sales service that owns the CRM database and accepts the existing
Core sign-in.

## Steps

1. Add `holita/apps/sales-api` as a small NestJS subgraph on Holita's operator Router (local
   port 12015). Give it a Holita-only PostgreSQL database and role, dedicated test database and
   role, and its own Prisma schema, client and migration directory. Wire up the existing
   Holita Nx/npm development, stop, database setup and migration paths and the root environment
   reference. Add the Sales server types to the
   explicit operator graph generation and schema checks.
   Use the ignored `holita/config/sales.env` for `PORT=12015`, `SALES_DATABASE_URL`,
   `SALES_TEST_DATABASE_URL`, `CORE_AUTH_VERIFY_URL` and the matching
   `CORE_INTERNAL_AUTH_TOKEN`. Use the `holita_sales` and `holita_sales_test` database/role
   pairs. Wire `SALES_GRAPHQL_URL` into the operator Router. Extend the initializer to
   generate the private Sales file on fresh setups. For existing checkouts document creating
   only the missing Sales file with fresh local database credentials and the current Core
   internal token, using a private file and without echoing values. Preserve all existing
   files. Run the existing Holita database setup, test setup and migrations for the new service.
2. Verify the bearer via `@osnova/auth` and Core, require an authenticated platform `SALES`
   account for CRM, and pass the verified platform `tenantId` and Core `userId` into services.
   All later Sales records carry that `tenantId`; scope every list, lookup and mutation and
   keep relationships inside the same tenant. Prospect work has no selected Branch; any
   eventual destination merchant and Branch IDs are references. The CRM team shares leads
   inside the platform tenant, with personal views based on Core user IDs.
3. Expose an operator-only workspace-access query returning the verified platform Tenant ID
   and Core user ID. Confirm the existing Core Sales demo account can run it through the operator
   Router and that anonymous, merchant and non-Sales platform callers are denied.

## Done when

The operator Router composes the Sales subgraph and the verified Core SALES account can read its
workspace identity. Other accounts lack CRM access. The storefront schema contains no Sales types
or fields, and the new database is isolated from Core and Commerce.

## Limits

Subgraph and lifecycle only. Ticket 300 connects the current Sales shell and extends the guarded
smoke. CRM data models and screens have their own tickets. Keep two Routers and the shared sign-in.

## References

- [Sales app entry point](../../holita/apps/sales/src/main.ts)
- [Operator graph descriptors](../../holita/tools/graphql/contracts.mts)
- [Holita runtime initializer](../../holita/tools/runtime-config.mts)
- [Holita setup](../development.md)
- [Workspace database ownership](../architecture/decisions/0002-database-ownership.md)
- [red.bg Sales service inventory](../../holita/docs/red-bg/services/sales.md)
- [red.bg CRM schema migration](../../../red.bg/workspace-sales/services/sales/database/migrations/2026_08_03_000003_create_crm_schema.php)
- [red.bg Sales routes](../../../red.bg/workspace-sales/services/sales/routes/web.php)
- [Holita operator subgraph registration](../../holita/tools/graphql/contracts.mts#L1)
