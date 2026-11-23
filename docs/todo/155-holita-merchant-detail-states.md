# 155 Show missing merchant and empty shops

**Status:** Ready. **Product:** Holita.

## Background

Opening a Backoffice merchant URL with a well-formed ID that does not exist leaves the title blank and can still show Create Shop after the request succeeds. The table receives null rows and cannot distinguish the missing merchant from loading.

## Goal

Give missing merchants and merchants with no shops distinct Backoffice states.

## Steps

1. Resolve loading, request failure, missing merchant and existing merchant with zero shops explicitly.
2. Show a localized not-found state with a Back action to the merchant directory. Show Create Shop and other merchant actions only for a loaded merchant and an authorized role. A loaded merchant with no shops keeps its own empty table state.

## Done when

A missing merchant URL shows not found with a working Back action and no merchant actions. A zero-shop merchant shows the empty shops table and a failed request offers retry.

## Limits

Backoffice presentation over the current merchant query.

## References

- [red.bg merchant detail controller](../../../red.bg/workspace-ecommerce/services/backoffice/app/Http/Controllers/Backoffice/Stores/MerchantsController.php)
- [Merchant detail and table state](../../holita/packages/operator/src/merchant-detail-page.ts#L119)
- [Merchant lookup](../../holita/packages/operator/src/merchant-detail-page.ts#L144)
- [Shared table state](../../osnova/packages/ui/src/ui/table-panel/table-view.ts)
