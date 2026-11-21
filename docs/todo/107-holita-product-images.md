# 107 Product image gallery

**Status:** Ready after [106](106-holita-product-editor.md). **Product:** Holita.

## Background

red.bg supports an ordered product gallery in the product editor.

## Goal

Merchants upload and arrange product photos that shoppers can see.

## Steps

1. Reuse the Commerce image storage from 101. Keep the product attachment, alt text and order. Use
   the first image as the cover.
2. Add upload, preview, alt text, reorder and remove to the Product drawer. Expose the public
   cover on catalogue cards and the gallery on the product page.
3. Seed three locally generated gallery images on a demo product, with alt text and a cover.

## Done when

Reordering changes the storefront cover, removed images disappear, and the public gallery respects
product visibility.

## Limits

Use product images only. Keep image processing and storage within the feature skill.

## References

- [Holita feature skill](../../.agents/skills/holita-feature/SKILL.md)
- [Upload service](../../../red.bg/workspace-ecommerce/services/api/app/Services/Uploads/AdminUploadService.php)
- [Admin gallery](../../../red.bg/workspace-ecommerce/services/admin/resources/views/admin/catalog/products/partials/form/gallery.blade.php)
- [Basic product page](../../../red.bg/workspace-ecommerce/services/storefront/basic/resources/views/storefront/product.blade.php)
