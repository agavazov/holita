# 171 Add reusable characteristic choices

**Status:** Ready after [170](170-holita-category-characteristics.md). **Product:** Holita.

## Background

red.bg product features can select one or multiple reusable values. Holita stores only free-text characteristic values.

## Goal

Let merchants use consistent characteristic values across products.

## Steps

1. Add reusable values and single- and multi-select fields alongside existing text. Validate selected values against their characteristic and its scope and enforce one value for a single-choice field.
2. Expose choice values in Admin product editing and render their labels in the storefront specification table.

## Done when

Existing text rows still render, and a merchant can choose valid values for a product and see them on its shop page.

## Limits

Product specifications only. No new storefront facet system in this ticket.

## References

- [red.bg feature rendering](../../../red.bg/workspace-ecommerce/services/admin/resources/views/admin/catalog/products/partials/form/features.blade.php)
- [Holita characteristic schema](../../holita/apps/commerce/src/commerce.graphql)
- [Holita product editor](../../holita/apps/admin/src/products/product-editor.ts)
- [red.bg characteristic group kinds](../../../red.bg/workspace-ecommerce/services/api/app/Enums/Catalog/FeatureGroupKind.php)
- [Holita current characteristic values](../../holita/apps/commerce/src/commerce.graphql#L490)
