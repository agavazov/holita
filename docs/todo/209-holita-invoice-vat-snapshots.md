# 209 Record approved VAT values on orders and invoice snapshots

**Status:** Needs owner. Which VAT-inclusive pricing rules, supported rates and rounding should apply to new orders and invoices? **Product:** Holita.

## Background

red.bg persists rate and amount for tax-inclusive lines. Holita saves invoice VAT identifiers without line rates or tax amounts.

## Goal

Store the approved VAT treatment on new orders and issued invoices so documents can use saved values.

## Steps

1. Confirm the shop tax model, supported rates and treatment of inclusive prices and rounding.
2. Persist approved rates and amounts on new orders and invoice snapshots. Keep older snapshots readable without treating missing values as zero.

## Done when

New orders and invoice snapshots reconcile to saved taxable amounts and rates. Existing invoices remain unchanged.

## Limits

Persistence and arithmetic only. VAT rendering follows in 255. No tax, exchange-rate or filing integration.

## References

- [red.bg order snapshots](../../../red.bg/workspace-ecommerce/services/api/app/Services/Commerce/OrderService.php)
- [Holita invoice data model](../../holita/apps/commerce/prisma/schema.prisma#L701)
- [Holita invoice snapshot service](../../holita/apps/commerce/src/invoices/invoices.service.ts)
- [Holita current invoice line model](../../holita/apps/commerce/prisma/schema.prisma#L732)
