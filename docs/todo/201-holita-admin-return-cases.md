# 201 Review and decide order return cases in Admin

**Status:** Ready. **Product:** Holita.

## Background

red.bg Admin lists return cases and allows staff to approve or reject the requested items. Holita records manual refunds directly and has no return case.

## Goal

Let merchants review and decide a return case for an order in the selected shop.

## Steps

1. Add scoped cases with requested order lines and quantities, reason, status and decision history. Require the lines to belong to the same order and seed one pending case for the demo.
2. Add the Admin Returns list, detail, approve and reject actions with shared request states.

## Done when

A merchant can view the seeded case and make an authorized decision. Another shop has no access to it.

## Limits

Merchant review and decisions only. Intake and settlement have separate tickets.

## References

- [red.bg return actions](../../../red.bg/workspace-ecommerce/services/admin/routes/admin.php#L389)
- [red.bg Returns controller](../../../red.bg/workspace-ecommerce/services/admin/app/Http/Controllers/Admin/Sales/ReturnsController.php)
- [Holita order refunds](../../holita/apps/commerce/src/refunds/refunds.service.ts)
