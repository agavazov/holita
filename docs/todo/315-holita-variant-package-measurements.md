# 315 Record variant weight and package dimensions

**Status:** Ready. **Product:** Holita.

## Background

The red.bg coverage report marks PRD-09 as P2. The variant contract has no supported weight or dimensions. The source exposes validated measures for catalogue and fulfilment use.

## Goal

Record variant weight and package dimensions.

## Steps

1. Add optional weight, width, height and depth with one documented unit per measurement and expose them in the relevant Admin and catalogue contracts.
2. Validate values in the existing variant write path and surface them in the variant editor and API.

## Done when

A merchant can save and clear valid measurements for one variant. Existing variants remain usable without measurements.

## Limits

No parcel selection, courier calculations or logistics integration.

## References

- [red.bg `editor-script.blade.php`](../../../red.bg/workspace-ecommerce/services/admin/resources/views/admin/catalog/products/partials/form/editor-script.blade.php#L554)
- [red.bg `ProductVariantResource.php`](../../../red.bg/workspace-ecommerce/services/api/app/Http/Resources/Storefront/ProductVariantResource.php)
- [Holita `apps/commerce/src/commerce.graphql:38`](../../holita/apps/commerce/src/commerce.graphql#L38)
- [Holita `apps/admin/src/products/product-editor.ts:656`](../../holita/apps/admin/src/products/product-editor.ts#L656)
