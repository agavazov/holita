# 326 Assign short searchable references to new orders

**Status:** Ready. **Product:** Holita.

## Background

The red.bg coverage report marks OR14 as P2. The current visible order number is unique but long. The source uses short references suitable for quoting to customers.

## Goal

Assign short searchable references to new orders.

## Steps

1. Generate a concise unique reference for every new scoped manual or storefront order and expose it through the current order number contract.
2. Keep existing references searchable and readable.

## Done when

A merchant can quote and find a short new order number, and a historical order still resolves by its original number.

## Limits

Keep internal UUIDs untouched. Avoid renumbering historical orders.

## References

- [red.bg `OrderNumberService.php`](../../../red.bg/workspace-ecommerce/services/api/app/Services/Commerce/OrderNumberService.php)
- [Holita `apps/commerce/src/orders/orders.service.ts:4`](../../holita/apps/commerce/src/orders/orders.service.ts#L4)
- [Holita `apps/commerce/prisma/schema.prisma:620`](../../holita/apps/commerce/prisma/schema.prisma#L620)
