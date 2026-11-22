# 147 Holita Admin polish

**Status:** Ready after [149](149-osnova-listing-mobile.md). **Product:** Holita.

## Background

Products and Badges share a double-tag icon. Inventory shows a truck, Collections a direction
sign and Characteristic groups an ID card. At 390 px, the Bulgarian create label on
Characteristic groups pushes both header actions onto a second row. The manual collection
editor cuts off selected product names beside the move and remove controls.

In the product drawer, a saved variant's quantity looks as editable as SKU and Price. The
variant picker puts similar group and value labels at the same left edge. Failed Brand and
Category lookups leave their warnings at the left and center Retry away from them, while tag
and gallery failures already keep the action near the warning. Sticky Category and Brand
delete-conflict toasts obscure the mobile page heading or create action.

## Goal

Make the Admin destinations distinct, keep long labels readable and put product drawer and
delete feedback where merchants can act on it.

## Steps

1. Set the Holita navigation icons in `holita/apps/admin/src/main.ts`. Use a box for Products,
   shelves or a stock glyph for Inventory, a stack for Collections, sliders or a checklist for
   Characteristic groups and one tag for Badges. Use the shared sidebar mapping supplied by 149
   so the desktop rail and mobile drawer show the same glyphs.
2. In the Bulgarian operator catalog, use “Добави група” under the full Characteristic groups
   heading and “Добави колекция” on Collections. Follow the “Добави значка” wording and retain
   the shared header's ability to wrap longer labels.
3. In the manual collection editor, let the selected product name wrap inside the existing
   `minmax(0, 1fr)` identity column. Keep the status and move/remove controls aligned.
4. Render a saved variant's quantity as a labeled read-only fact using shared `.app-facts`
   styling. Retain the Inventory hint for tracked variants and the editable initial quantity
   input for a new tracked variant.
5. In the grouped variant picker, use compact, visually distinct group labels and indented
   choice rows. Let both wrap and open the picker with the first visible choice fully in view.
6. Keep each optional lookup warning and its Retry action together in a compact field feedback
   row with shared token spacing. Align Brand and Category with the existing tag and gallery
   feedback. Let the row wrap in narrow drawers and preserve the retry behavior.
7. Show Category and Brand dependency conflicts in the originating TablePanel's inline feedback
   area provided by 149, above the retained rows. Reuse the localized conflict messages and
   reserve the panel's refresh error state for failed loads.

## Done when

At 390 px, the Bulgarian create buttons fit alongside the other header action where space permits,
selected product names are readable and their controls remain usable. Saved quantity reads as a
fact and a new tracked variant accepts an initial quantity. Long variant groups and values are
easy to distinguish when the picker opens. Retry sits next to each lookup warning. A Category
or Brand delete conflict wraps above its list and leaves the heading and create action visible.
Verify the rail and drawer icons and review the affected states at 390 × 844 and 1440 × 900 in
light and dark, using Bulgarian and English where applicable.

## Limits

Holita Admin presentation and Bulgarian labels only. Use existing shared styling and the
override points from 149. Preserve existing catalog operations, validation and delete behavior.

## References

- [Shared listing and sidebar support in ticket 149](149-osnova-listing-mobile.md)
- [Admin design system](../admin-design-system.md)
- [Admin navigation](../../holita/apps/admin/src/main.ts) and [Bulgarian labels](../../holita/packages/operator/src/i18n/bg.json)
- [Collection editor styles](../../holita/apps/admin/src/collections/collection-editor.scss)
- [Product editor template](../../holita/apps/admin/src/products/product-editor.html), [picker configuration](../../holita/apps/admin/src/products/product-editor.ts) and [drawer styles](../../holita/apps/admin/src/products/product-editor.scss)
- [Category delete handling](../../holita/apps/admin/src/categories/categories-page.ts) and [Brand delete handling](../../holita/apps/admin/src/brands/brands-page.ts)
