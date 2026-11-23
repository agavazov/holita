# 268 Page the merchant directory and load one merchant at a time

**Status:** Ready after [155](155-holita-merchant-detail-states.md). **Product:** Holita.

## Background

Opening one merchant in Backoffice or Sales downloads every merchant and all their shops. The directory uses the same nested query even though each list row needs only merchant identity, status and shop count. Both screens do more work as the platform grows.

## Goal

Return one bounded directory page and load shops only for the selected merchant detail.

## Steps

1. Add server pagination for compact Core merchant rows with a total and a separate authorized read keyed by merchant Tenant ID for the detail and its shops.
2. Move the shared Backoffice and Sales operator views to these reads. Preserve the states from 155 and refresh the relevant page or detail after existing Backoffice writes.
3. Regenerate the operator contracts and verify the operator schema and current Staff and Sales role access across Core and Gateway.

## Done when

Opening either directory requests only one page of compact merchant rows. Opening a detail requests the selected merchant and its shops only. Backoffice keeps its current writes, Sales access stays read-only and merchants cannot read the platform directory.

## Limits

Keep the current platform roles. Merchant contact edits and the global shop directory follow in 237 and 238. Reuse an existing Core case for a needed cross-service or role regression within the test budget.

## References

- [red.bg Backoffice merchant directory](../../../red.bg/workspace-ecommerce/services/backoffice/app/Http/Controllers/Backoffice/Stores/MerchantsController.php)
- [Shared operator merchant query](../../holita/packages/operator/src/operations.graphql#L1)
- [Shared merchant detail](../../holita/packages/operator/src/merchant-detail-page.ts#L144)
- [Core directory read](../../osnova/apps/core/src/modules/platform/platform.repository.ts#L6)
