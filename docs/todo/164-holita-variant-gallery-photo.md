# 164 Show the photo for the selected variant

**Status:** Ready. **Product:** Holita.

## Background

red.bg links variant choices to product images. Holita product galleries and variant selection are independent.

## Goal

Let merchants associate a gallery image with a variant and show it when the shopper selects that variant.

## Steps

1. Add an optional variant image reference with ownership validation and appropriate handling when its gallery image is removed.
2. Add an existing-image picker in Admin and select the referenced image on product detail.

## Done when

Variants can show different images from the same gallery. A variant without one keeps a usable gallery.

## Limits

Use existing gallery files and the current photo picker pattern.

## References

- [red.bg Basic product view model](../../../red.bg/workspace-ecommerce/services/storefront/basic/app/Services/Storefront/ProductDetailView.php)
- [Holita product editor](../../holita/apps/admin/src/products/product-editor.ts)
- [Holita product view](../../holita/apps/storefront/src/main.ts)
