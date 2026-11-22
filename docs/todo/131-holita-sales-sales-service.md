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
   reference. Add the Sales server types and Sales application TypedDocumentNodes to the
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
3. Connect a protected workspace-access query to the existing Sales sign-in and shell. Its
   viewer fields are the verified platform tenant ID and Core user ID. Keep Merchants as the
   existing landing screen and show localized access feedback when CRM access is denied.
   Preserve the existing Core API permissions for merchant reads.
4. Reuse the existing insert-only Core Sales demo account. This ticket seeds no CRM rows;
   feature tickets add them when their models exist.
5. Extend the existing guarded Holita Playwright harness and smoke case. Add Sales API to the
   Nx smoke build inputs. Extend the existing test-database helper to validate the dedicated
   Sales test URL and create/migrate a disposable schema; start the Sales API on an ephemeral
   port against that schema. Serve the Sales Angular build through the existing same-origin
   proxy; point the operator Router at the isolated Sales API and pass `SALES_ORIGIN`.
   Register normal teardown for the service, UI and schema. In the existing case, sign in
   through Sales with the seeded Core SALES account and assert the protected workspace
   query succeeds through the Router and the shell loads. Send the same query through the
   Router without a session and with signed-in non-Sales platform and merchant accounts
   and assert access is denied. Extend the current case without adding a test case.

## Done when

The seeded Sales account reaches the Sales shell and its protected query through the operator
Router. Anonymous, demo-tenant, merchant and non-Sales platform identities cannot use the CRM
query. The public storefront schema has no Sales types or fields. The existing Holita
smoke case exercises the Sales UI and operator Router with isolated test resources and
cleans up the resources it starts.

## Limits

Use the existing two Routers and shared sign-in. Keep Sales persistence out of Commerce, Core,
and Osnova packages. No other app routes, new roles, Sales credential store or placeholder screens.

## References

- [Sales app entry point](../../holita/apps/sales/src/main.ts)
- [Operator graph descriptors](../../holita/tools/graphql/contracts.mts)
- [Guarded Holita browser smoke](../../holita/tools/browser/holita.smoke.spec.mts)
- [Holita runtime initializer](../../holita/tools/runtime-config.mts)
- [Holita setup](../development.md)
- [Workspace database ownership](../architecture/decisions/0002-database-ownership.md)
- [red.bg Sales service inventory](../../holita/docs/red-bg/services/sales.md)
- [red.bg CRM schema migration](/workspace/projects/red.bg/workspace-sales/services/sales/database/migrations/2026_08_03_000003_create_crm_schema.php)
- [red.bg Sales routes](/workspace/projects/red.bg/workspace-sales/services/sales/routes/web.php)
