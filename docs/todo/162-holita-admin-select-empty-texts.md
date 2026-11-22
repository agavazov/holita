# 162 Localize empty states in Admin selectors

**Status:** Ready. **Product:** Holita.

## Background

Both Holita operator catalogs have matching keys. Collection and manual-order PrimeNG selectors omit some empty/no-match inputs, which fall back to English in the Bulgarian UI.

## Goal

Show the selected BG or EN language when merchant select lists have no options or matches.

## Steps

1. Use the existing localized empty and no-results labels on collection category and brand selectors and manual order customer, payment and shipping selectors.
2. Check the equivalent Products brand/category/badge selectors and cover the same default where a binding is missing.

## Done when

An empty choice list or a search with no matches shows localized copy in both languages.

## Limits

Selector text only. Preserve loading and lookup error behavior.

## References

- [Collection editor](../../holita/apps/admin/src/collections/collection-editor.html)
- [Manual order editor](../../holita/apps/admin/src/orders/manual-order-editor.html)
- [Product editor](../../holita/apps/admin/src/products/product-editor.html)
- [Bulgarian catalog](../../holita/packages/operator/src/i18n/bg.json)
- [English catalog](../../holita/packages/operator/src/i18n/en.json)
