# 144 Hand off a won lead to an existing merchant

**Status:** Ready after [141](141-holita-sales-won-lead-conversion.md). **Product:** Holita.

## Background

red.bg can link an existing Core merchant, link one of its stores and create a store for that
merchant. Holita exposes existing merchants and their Branches to Sales for reading. Its general
Branch-create mutation still requires a platform administrator or operator.

## Goal

Let an agent hand off a Won lead to an explicitly selected existing merchant and either an
existing shop or a newly created shop for that merchant.

## Steps

1. In the existing Won Lead Detail handoff editor add Use existing merchant. List explicit
   choices using the Core merchant directory. Show only the selected merchant's eligible
   Branches, with a separate Create shop action and shop-name field. No matching by email,
   company name or prospect URL.
2. For an existing Branch, use a server-verified Core read before saving. Verify that the
   merchant is an active customer Tenant and the active Branch belongs to it, even if the
   IDs were supplied directly. For a new Branch add a narrow internal Core command using
   the authenticated internal transport and real platform SALES session. In Core verify
   the target merchant, then create exactly one Branch under it. Reuse 143's scoped replay
   pattern with a separate operation kind. Keep the existing platform GraphQL permissions.
3. Extend the one-per-lead handoff record from 141 with the two destination modes
   (`existingBranch`, `newBranch`) and explicit Core merchant Tenant and Branch IDs.
   Keep handoff ID, initiation Core user, state and timestamps. Link a verified pair
   directly or complete the new-Branch mode after Core confirms. Retry an uncertain
   shop creation with the same operation ID. Show the linked merchant and storefront
   on Lead Detail using the existing handoff presentation.
4. Add one unconverted Won demo lead for each path and one completed existing-Branch
   handoff referencing the existing demo merchant and shop. Use stable Sales fixture
   IDs and preserve the seeded Core records.

## Done when

An agent can complete either existing-merchant path without creating another merchant.
Selecting a Branch from another merchant is rejected server-side. A repeated new-shop
request yields the same Branch. Both successful paths link to the correct merchant and
shop and leave the lead Won.

## Limits

No merchant-account changes, cross-merchant Branch reassignment, implicit matches,
bulk links or general Backoffice permissions. One completed handoff per lead.

## References

- [Core merchant directory and Branch mutation](../../osnova/apps/core/src/modules/tenants/tenants.graphql)
- [Core public Branch resolution](../../osnova/apps/core/src/modules/branches/internal-branches.controller.ts)
- [red.bg merchant links and existing shop selection](/workspace/projects/red.bg/workspace-sales/services/sales/app/Http/Controllers/Sales/MerchantsController.php)
- [red.bg shop creation for a merchant](/workspace/projects/red.bg/workspace-sales/services/sales/app/Http/Controllers/Sales/StoresController.php)
- [red.bg merchant link form](/workspace/projects/red.bg/workspace-sales/services/sales/resources/views/sales/merchants/partials/link-form.blade.php)
- [red.bg merchant shops screen](/workspace/projects/red.bg/workspace-sales/services/sales/resources/views/sales/merchants/stores/index.blade.php)
