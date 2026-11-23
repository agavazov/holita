# 317 Compare order activity with the previous dashboard period

**Status:** Ready after [127](127-holita-dashboard.md). **Product:** Holita.

## Background

red.bg's merchant dashboard compares order activity with a preceding period and breaks it down by order status. Holita has a basic shop dashboard in 127 and a separate sales report in 221 with its own order population.

## Goal

Let merchants compare the selected shop dashboard period with the immediately preceding period of the same length.

## Steps

1. Extend the scoped dashboard read with order count and revenue deltas, gross turnover, average order value, daily totals and counts by order status. Use the dashboard's existing time boundaries and document which statuses feed each money metric.
2. Present the comparison and status breakdown using the existing Admin dashboard patterns. Handle empty periods with defined zero values and avoid percentage division by zero.

## Done when

Switching periods updates both sets of totals, a known shop's totals reconcile to its orders and no data from another shop affects the comparison.

## Limits

Order KPI and status comparison on the dashboard. Keep the separate sales report contract and scope in 221.

## References

- [red.bg dashboard metrics](../../../red.bg/workspace-ecommerce/services/api/app/Services/Commerce/DashboardService.php#L67)
- [red.bg dashboard presentation](../../../red.bg/workspace-ecommerce/services/admin/resources/views/admin/dashboard/index.blade.php#L84)
- [Holita Admin entries](../../holita/apps/admin/src/main.ts#L58)
- [Holita order fields](../../holita/apps/commerce/src/commerce.graphql#L690)
