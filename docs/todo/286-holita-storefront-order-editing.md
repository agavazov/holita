# 286 Allow safe Admin edits of eligible storefront orders

**Status:** Ready. **Product:** Holita.

**Depends on** [256](256-holita-invoiced-manual-order-amounts.md).

## Background

The red.bg coverage report marks OR04 as P1. The manual-order editor is limited to eligible manual orders. The merchant cannot correct an eligible storefront order through the same workflow.

## Goal

Allow safe Admin edits of eligible storefront orders.

## Steps

1. Define which storefront order states admit the existing operator edits and expose them through the existing order edit entry point.
2. Reuse scoped stock reconciliation and payment and invoice snapshot protections. Preserve shopper and source identity.

## Done when

An eligible online order can be corrected and reconciles stock correctly. Ineligible, paid or invoiced orders follow the protected policy and preserve issued records.

## Limits

Reuse the manual editor and the order guard corrected in ticket 256. Keep any additional new edit fields separate.

## References

- [red.bg `OrdersController.php`](../../../red.bg/workspace-ecommerce/services/admin/app/Http/Controllers/Admin/Sales/OrdersController.php)
- [red.bg `OrderService.php`](../../../red.bg/workspace-ecommerce/services/api/app/Services/Commerce/OrderService.php)
- [Holita `apps/commerce/src/orders/orders.service.ts:188`](../../holita/apps/commerce/src/orders/orders.service.ts#L188)
- [Holita `apps/admin/src/orders/manual-order-editor.ts:115`](../../holita/apps/admin/src/orders/manual-order-editor.ts#L115)
