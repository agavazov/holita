# 222 Show best sellers and category sales

**Status:** Ready after [221](221-holita-admin-sales-report.md). **Product:** Holita.

## Background

red.bg reports best sellers from sold line snapshots and categories from the current product catalogue. The selected date range excludes cancelled orders.

## Goal

Show the highest-selling products and categories for the report period.

## Steps

1. Extend the scoped report with revenue and unit counts for top products using sold line snapshots. Apply the same date range and cancelled-order exclusion as the 221 totals. Join surviving products to current catalogue categories for the category section.
2. Show both sections under the same date controls. Let uncategorized or missing products contribute to headline and applicable product totals without assigning them to a category.

## Done when

Both breakdowns react to the date range and exclude cancelled orders. Moving a product to another category updates the category grouping without changing order snapshots.

## Limits

Best sellers and current category breakdown only. Keep report filters and series from 221.

## References

- [red.bg aggregation](../../../red.bg/workspace-ecommerce/services/api/app/Services/Commerce/SalesAnalyticsService.php#L31)
- [red.bg report view](../../../red.bg/workspace-ecommerce/services/admin/resources/views/admin/analytics/sales/index.blade.php#L79)
- [Holita stored order line contract](../../holita/apps/commerce/src/commerce.graphql#L634)
