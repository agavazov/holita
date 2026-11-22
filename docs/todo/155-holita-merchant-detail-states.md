# 155 Show missing merchant and empty shops

**Status:** Ready. **Product:** Holita.

## Background

A successful Backoffice merchant list response without the requested merchant leaves rows null in MerchantDetailPage. The shared TablePanel interprets null as loading, and the create action can still be visible.

## Goal

Give missing merchants and merchants with no shops distinct Backoffice states.

## Steps

1. Resolve loading, request failure, missing merchant and existing merchant with zero shops explicitly.
2. Show localized retry, back and empty states with Osnova components. Offer Create Shop only for a loaded merchant and authorized role.

## Done when

A missing merchant URL exits loading, a zero-shop merchant shows the empty state, and a failed load offers retry.

## Limits

Backoffice presentation over the current merchant query.

## References

- [Merchant detail](../../holita/packages/operator/src/merchant-detail-page.ts)
- [Shared table state](../../osnova/packages/ui/src/ui/table-panel/table-view.ts)
