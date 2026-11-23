# 188 Configure fixed Basic homepage content and announcement

**Status:** Ready. **Product:** Holita.

## Background

red.bg fixed Basic settings include homepage hero content, shop destinations and a header announcement. Holita's shop root is a catalogue, and general store identity and contacts shipped in `946cb21d`.

## Goal

Let merchants set a localized welcome, one visual and a storefront announcement in one Basic settings form.

## Steps

1. Extend the saved shop settings with BG/EN homepage welcome and announcement, an internal destination, and one local hero image picker. Use the existing Commerce raster storage and validation pattern and support replacement or removal.
2. Render the fixed homepage content and optional header announcement. Keep browsing available and use publication rules for linked destinations.

## Done when

Saving or clearing the content updates only that shop. The hero consumes its saved local image and the announcement can be turned off.

## Limits

One fixed hero and announcement only. The tile, benefits and featured collection sections have their own scopes.

## References

- [red.bg Basic settings controller](../../../red.bg/workspace-ecommerce/services/admin/app/Http/Controllers/Admin/Settings/StorefrontBasicController.php#L100)
- [Holita product image picker](../../holita/apps/admin/src/image-upload.ts)
- [Holita storefront shell](../../holita/apps/storefront/src/main.ts)
- [red.bg Basic homepage view data](../../../red.bg/workspace-ecommerce/services/storefront/basic/app/Services/Storefront/StorefrontHomeView.php)
- [Holita shop settings persistence](../../holita/apps/commerce/src/shop-settings/shop-settings.service.ts#L35)
- [Holita existing shop root](../../holita/apps/storefront/src/main.ts#L919)
