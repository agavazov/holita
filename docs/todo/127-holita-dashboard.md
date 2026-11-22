# 127 Admin shop dashboard

**Status:** Ready after [118](118-holita-admin-order-management.md), [120](120-holita-customer-detail.md). **Product:** Holita.

## Background

red.bg’s dashboard summarizes order activity, revenue, customers and inventory.

## Goal

Merchants can see their shop’s current activity at a glance.

## Steps

1. Query the selected shop for order count, completed order revenue, new customers and tracked
   variants out of stock. Use 7-, 14- and 30-day windows for dated metrics.
2. Add an Admin dashboard with shared KPI and chart patterns and a recent-orders list linking to
   Order Detail. Keep the dashboard in the operator graph.
3. Seed orders on several dates and a new customer so that period selection and completed revenue
   can be checked against known totals.

## Done when

Changing the date window updates the dated metrics, the recent order links open the right records
and an empty shop displays zero states.

## Limits

Use live Commerce data. Storefront pages and external analytics are outside this slice.

## References

- [Holita feature skill](../../.agents/skills/holita-feature/SKILL.md)
- [Dashboard service](../../../red.bg/workspace-ecommerce/services/api/app/Services/Commerce/DashboardService.php)
- [Admin dashboard](../../../red.bg/workspace-ecommerce/services/admin/resources/views/admin/dashboard/index.blade.php)
