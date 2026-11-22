# 179 Manage shop logo and favicon

**Status:** Ready after [126](126-holita-general-settings.md). **Product:** Holita.

## Background

red.bg Admin has logo and favicon upload and removal. Holita image storage serves product and brand photos. Queue 126 covers the public display name and contact details.

## Goal

Let a merchant manage shop identity images for Basic storefront.

## Steps

1. Reuse scoped Commerce image validation and storage. Allow edit, preview, replace and remove for logo and favicon.
2. Expose the active shop images to the public storefront and use them in the header and browser tab.

## Done when

The selected shop gets its saved logo and favicon, and removing them restores its text/default identity.

## Limits

Fixed Basic storefront only. Use existing raster and local storage conventions.

## References

- [red.bg logo editor](../../../red.bg/workspace-ecommerce/services/admin/app/Http/Controllers/Admin/Design/LogoController.php)
- [Holita image pattern](../../holita/apps/admin/src/brands/brand-editor.ts)
- [Storefront shell](../../holita/apps/storefront/src/main.ts)
- [General settings queue](../../docs/todo/126-holita-general-settings.md)
