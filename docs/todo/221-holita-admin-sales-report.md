# 221 Report shop sales over a merchant-selected date range

**Status:** Ready. **Product:** Holita.

## Background

red.bg has a separate sales report over selected dates. It counts orders other than cancelled and shows headline totals and a daily revenue series.

## Goal

Let merchants see actual sales activity for their chosen dates.

## Steps

1. Add a Tenant and Branch scoped report for a selected date range. Exclude cancelled orders and calculate revenue, order count, sold units and average order value from stored orders and lines.
2. Show date inputs, headline totals and daily revenue including zero-result days on a separate Admin page with localized loading, empty and error states.

## Done when

Changing the date range updates the totals and chart. A cancelled order contributes to neither, and another shop's orders are excluded.

## Limits

Sales report only. Keep the shop dashboard and external analytics separate. Best sellers and category breakdown follow in 222.

## References

- [red.bg sales aggregation](../../../red.bg/workspace-ecommerce/services/api/app/Services/Commerce/SalesAnalyticsService.php#L31)
- [red.bg Admin report](../../../red.bg/workspace-ecommerce/services/admin/resources/views/admin/analytics/sales/index.blade.php#L79)
- [Holita Admin routes](../../holita/apps/admin/src/main.ts)
- [Holita operator order fields](../../holita/apps/commerce/src/commerce.graphql#L690)
