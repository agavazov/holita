# 237 Find merchants and maintain their account details

**Status:** Ready after [268](268-holita-merchant-directory-pagination.md). **Product:** Holita.

## Background

red.bg Backoffice has a merchant directory and merchant account view and editor. Holita lists merchant Tenants and their shops, with create and suspend/reactivate actions, but omits contact details.

## Goal

Let authorized Backoffice staff find a merchant and maintain a selected merchant operator's supported contact data.

## Steps

1. Extend the paged merchant search and scoped detail from 268 with merchant identity filters and supported contact fields. Reuse the loading, not-found and error states from 155. Show associated merchant accounts and allow explicit selection when there is more than one.
2. Add supported name and email edits with existing Core validation and localized field feedback.

## Done when

Staff can find a merchant, view its accounts and save the selected permitted account fields. Merchant app clients cannot access platform reads.

## Limits

Preserve merchant status and shop management. Do not infer an account from list order or combine password changes with profile edits.

## References

- [red.bg Backoffice merchants](../../../red.bg/workspace-ecommerce/services/backoffice/app/Http/Controllers/Backoffice/Stores/MerchantsController.php)
- [Holita merchant detail](../../holita/packages/operator/src/merchant-detail-page.ts)
- [Core platform service](../../osnova/apps/core/src/modules/platform/platform.service.ts)
- [Holita merchant list](../../holita/packages/operator/src/merchants-page.ts#L123)
- [Holita merchant detail page](../../holita/packages/operator/src/merchant-detail-page.ts#L105)
