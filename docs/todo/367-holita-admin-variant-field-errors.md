# 367 Mark the conflicting SKU on its Admin variant row

**Status:** Ready. **Product:** Holita.

## Background

Independent review HLR-09 identified this behavior at `1b44cc90`. Commerce reports the path to a conflicting SKU, but nested field paths can disappear before the product editor displays the error.

## Goal

Mark the conflicting SKU on its Admin variant row.

## Steps

Trace the nested field error through the existing operator contract and show it on the matching variant row. Any proposed shared Osnova change needs a ticket explicitly scoped to it.

## Done when

Entering a SKU already used by another product in the same shop displays localized feedback at the correct variant row.

## Limits

Operator variant validation on the verified public contract.

## References

- [commerce.repository.ts](../../holita/apps/commerce/src/products/commerce.repository.ts#L292)
- [commerce.service.ts](../../holita/apps/commerce/src/products/commerce.service.ts#L96)
- [app.module.ts](../../holita/apps/commerce/src/app.module.ts#L145)
- [compatibility.rhai](../../osnova/tools/router/compatibility.rhai#L11)
