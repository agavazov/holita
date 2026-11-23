# 320 Show order methods and low stock on the shop dashboard

**Status:** Ready. **Product:** Holita.

## Background

red.bg shows breakdowns by payment and delivery method and highlights active products and variants low in stock. Holita's shop dashboard shows order totals and an out-of-stock count.

## Goal

Give merchants a quick view of the manual methods shoppers use and products that need replenishment.

## Steps

1. Aggregate order counts by the saved payment and delivery methods for the dashboard period and selected shop. Preserve readable historical method names.
2. Add a current active-product count and a low-stock summary for active tracked variants. Document the small positive threshold used, keep out-of-stock separate and link to Inventory.

## Done when

Orders for two manual methods appear under the corresponding saved names, and only tracked active variants with positive stock at or below the stated threshold contribute to low stock. The figures reflect the selected shop.

## Limits

Use existing manual method snapshots and inventory. No new method or inventory settings.

## References

- [red.bg dashboard method breakdown](../../../red.bg/workspace-ecommerce/services/api/app/Services/Commerce/DashboardService.php#L98)
- [red.bg dashboard inventory metrics](../../../red.bg/workspace-ecommerce/services/api/app/Services/Commerce/DashboardService.php#L365)
- [Holita order fields](../../holita/apps/commerce/src/commerce.graphql#L690)
- [Holita inventory quantity](../../holita/apps/commerce/src/commerce.graphql#L129)
