# 179 Manage shop logo and favicon

**Status:** Ready. **Product:** Holita.

## Background

red.bg Admin has logo and favicon upload and removal. Holita image storage serves product and brand photos. Public display name and contact details shipped in `946cb21d`.

## Goal

Let a merchant manage shop identity images for Basic storefront.

## Steps

1. Reuse scoped Commerce image validation and storage. Allow edit, preview, replace and remove for logo and favicon.
2. Expose the active shop images to the public storefront and use them in the header and browser tab.

## Done when

The selected shop uses its saved logo and favicon in Basic, and another shop keeps its own identity. Removing either asset restores the corresponding text/default identity.

## Limits

Fixed Basic storefront only. Use existing raster and local storage conventions.

## References

- [red.bg logo editor](../../../red.bg/workspace-ecommerce/services/admin/app/Http/Controllers/Admin/Design/LogoController.php)
- [Holita image pattern](../../holita/apps/admin/src/brands/brand-editor.ts)
- [Storefront shell](../../holita/apps/storefront/src/main.ts)
- [Holita existing shop settings](../../holita/apps/admin/src/shop-settings/shop-settings-page.ts#L67)
- [Holita text identity in Basic](../../holita/apps/storefront/src/main.ts#L81)
