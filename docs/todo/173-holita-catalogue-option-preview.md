# 173 Show selected option values on catalogue cards

**Status:** Ready after [172](172-holita-option-colour-chips.md). **Product:** Holita.

## Background

red.bg options can be marked for display in listings and Basic has a product-card option view. Holita exposes a shop option's filter setting only.

## Goal

Let merchants choose which variant option values are previewed on a catalogue card.

## Steps

1. Add a show-in-listing option flag and include distinct relevant values in the public card response.
2. Render compact labelled values or swatches in catalogue cards using existing storefront typography and states.

## Done when

Turning on the setting adds a preview for the relevant products only. The current card links and filtering still work.

## Limits

Card preview only. Keep variant purchasing on product detail.

## References

- [red.bg option settings](../../../red.bg/workspace-ecommerce/services/admin/resources/views/admin/catalog/options/partials/form.blade.php)
- [Holita catalogue view](../../holita/apps/storefront/src/catalogue-browse.html)
- [Holita option contract](../../holita/apps/commerce/src/commerce.graphql)
