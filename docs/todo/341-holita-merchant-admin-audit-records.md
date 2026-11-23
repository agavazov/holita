# 341 Record scoped audit events for sensitive merchant Admin changes

**Status:** Ready. **Product:** Holita.

## Background

The red.bg coverage report marks OPS06 as P2. The existing scoped operations verify identity but do not provide a general audit record for merchant changes.

## Goal

Record scoped audit events for sensitive merchant Admin changes.

## Steps

1. Add the smallest persistent audit record for representative customer-contact and shop-settings changes, recording the verified actor, action, target, outcome, Tenant and Branch.
2. Use committed outcomes from the existing write operations and avoid recording submitted personal values.

## Done when

An authorized representative mutation records who acted and where. Actor identity and shop scope come from verified context.

## Limits

No audit viewer. Keep Backoffice operations in ticket 342 and reuse the DSAR audit format where compatible.

## References

- [red.bg `LogOfficerActions.php`](../../../red.bg/workspace-ecommerce/services/backoffice/app/Http/Middleware/LogOfficerActions.php)
- [red.bg `RecordAdminAudit.php`](../../../red.bg/workspace-ecommerce/services/api/app/Http/Middleware/RecordAdminAudit.php)
- [Holita `apps/commerce/src/customers/customers.service.ts:73`](../../holita/apps/commerce/src/customers/customers.service.ts#L73)
- [Holita `apps/commerce/src/shop-settings/shop-settings.service.ts:24`](../../holita/apps/commerce/src/shop-settings/shop-settings.service.ts#L24)
