# 304 Create a shop during handoff to an existing merchant

**Status:** Ready after [144](144-holita-sales-existing-merchant-handoff.md). **Product:** Holita.

## Background

Ticket 144 hands off a Won lead to an existing merchant and Branch. red.bg also lets Sales
create a new shop for the selected merchant. Core's general Branch-create mutation requires
platform administrator or operator privileges.

## Goal

Let an authenticated Sales agent hand off a Won lead with one new shop under the chosen existing
merchant.

## Steps

1. Add a narrow internal Core command using existing internal transport and the originating
   platform SALES session. Reuse Core merchant provisioning's ownership validation and tenant-scoped
   replay pattern with a separate operation kind. Verify an active customer Tenant and create a
   Branch for it in one replayable operation.
2. Add a Create shop choice and shop-name field to the existing handoff drawer. Reuse the
   existing handoff state and validation model for the `newBranch` mode. Persist the operation ID
   and retry an uncertain response with it. Complete the handoff only after Core confirms.
3. Use the existing handoff result links and filters. Add one eligible insert-only demo Won
   lead and use isolated synthetic shop creation to verify the command.

## Done when

A Won lead can link to a newly created shop under the selected existing merchant. Repeating
the same operation returns the same Branch. The new mode leaves the merchant and current
Core permissions intact.

## Limits

One new Branch for the selected merchant. General shop administration and approvals are
outside this slice.

## References

- [red.bg Sales shop creation](../../../red.bg/workspace-sales/services/sales/app/Http/Controllers/Sales/StoresController.php#L99)
- [Holita existing Sales merchant entry](../../holita/apps/sales/src/main.ts#L9)
- [Core Branch and platform mutations](../../osnova/apps/core/src/modules/tenants/tenants.graphql#L61)
