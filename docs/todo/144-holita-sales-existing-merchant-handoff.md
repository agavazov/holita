# 144 Hand off a won lead to an existing merchant

**Status:** Ready. **Product:** Holita.

## Background

red.bg can link an existing Core merchant, link one of its stores and create a store for that
merchant. Holita exposes existing merchants and their Branches to Sales for reading. Its general
Branch-create mutation still requires a platform administrator or operator.

## Goal

Let an agent hand off a Won lead to an explicitly selected current merchant and shop.

## Steps

1. Add Use existing merchant to the Won Lead Detail handoff editor. Use the Core merchant
   directory and show eligible Branches for the selected merchant with explicit selection.
2. Verify in Core that the selected merchant is an active customer Tenant and that the active
   Branch belongs to it before saving. Extend the existing one-per-lead handoff record with
   an `existingBranch` mode and reuse its verified tenant scope, initiator, state and timestamps.
   Show the linked merchant and storefront through the existing handoff presentation.
3. Add URL-backed Leads filters for handoff state, initiator including Mine, and completed-date
   range. Keep the initiator distinct from the current lead assignee. Reuse these filters in 142.
4. Seed one eligible unconverted Won lead and one already handed off to an existing demo shop.
   Preserve the existing Core fixtures.

## Done when

An agent can hand off an eligible Won lead to an active merchant and existing Branch. A mismatched
owner or Branch is rejected. A completed handoff stays linked once and is available through the
same Lead Detail and list filters.

## Limits

Existing Branch handoff only. Ticket 304 handles creating a shop for the selected merchant.
Lead handoff has no effect on existing merchant relationships or general Core permissions.

## References

- [Core merchant directory and Branch mutation](../../osnova/apps/core/src/modules/tenants/tenants.graphql)
- [Core public Branch resolution](../../osnova/apps/core/src/modules/branches/internal-branches.controller.ts)
- [red.bg merchant links and existing shop selection](../../../red.bg/workspace-sales/services/sales/app/Http/Controllers/Sales/MerchantsController.php)
- [red.bg shop creation for a merchant](../../../red.bg/workspace-sales/services/sales/app/Http/Controllers/Sales/StoresController.php)
- [red.bg merchant link form](../../../red.bg/workspace-sales/services/sales/resources/views/sales/merchants/partials/link-form.blade.php)
- [red.bg merchant shops screen](../../../red.bg/workspace-sales/services/sales/resources/views/sales/merchants/stores/index.blade.php)
- [Holita existing Sales merchant routes](../../holita/apps/sales/src/main.ts#L9)
