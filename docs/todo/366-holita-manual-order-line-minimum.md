# 366 Show the effective minimum when editing manual order quantities

**Status:** Ready. **Product:** Holita.

## Background

Independent review HLR-08 identified this behavior at `1b44cc90`. When an existing manual order is reopened the editor assigns a minimum of one per row. Commerce can reject an updated quantity below the actual minimum.

## Goal

Show the effective minimum when editing manual order quantities.

## Steps

Expose and show the current minimum for changed manual order quantities while respecting the existing historic-line rule.

## Done when

For a variant with a minimum of five, changing an existing line to two gives specific feedback before submission. An unchanged historical line can still be saved under the current rules.

## Limits

Manual order edit form and the contract fields it needs.

## References

- [manual-order-editor.ts](../../holita/apps/admin/src/orders/manual-order-editor.ts#L771)
- [manual-order-editor.html](../../holita/apps/admin/src/orders/manual-order-editor.html#L199)
- [manual-order-lines.ts](../../holita/apps/commerce/src/orders/manual-order-lines.ts#L85)
