# 166 Record and search variant barcodes

**Status:** Ready. **Product:** Holita.

## Background

red.bg has variant barcode editing and validation. Holita identifies variants by SKU only.

## Goal

Allow optional barcode identification from the existing catalogue and inventory workflow.

## Steps

1. Persist an optional validated barcode under the correct shop scope and add it to the variant editor.
2. Include barcode in the supported Admin variant or inventory search.

## Done when

A merchant can save a variant barcode and find that variant by the code.

## Limits

Optional barcode only. No scanner integration.

## References

- [red.bg variant rules](../../../red.bg/workspace-ecommerce/services/api/app/Services/Catalog/ProductService.php)
- [Holita product input](../../holita/apps/commerce/src/commerce.graphql)
- [Holita inventory](../../holita/apps/admin/src/inventory/inventory-page.ts)
