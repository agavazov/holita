# 335 Configure contact and social links in the Basic footer

**Status:** Ready. **Product:** Holita.

**Depends on** [180](180-holita-shop-locales.md).

## Background

The red.bg coverage report marks ST06 as P2. Basic already shows shop contact information and languages. Merchants cannot select footer visibility or maintain links to their profiles.

## Goal

Configure contact and social links in the Basic footer.

## Steps

1. Add scoped settings for contact visibility, language-selector visibility and validated merchant-provided social links.
2. Apply the settings in the current Basic footer using existing contact fields and ticket 180's allowed languages.

## Done when

A merchant can set profile links and choose whether to show footer contacts and the language switcher for their shop.

## Limits

Ordinary outbound links only. Keep marketing connectors and tracking out.

## References

- [red.bg `StorefrontBasicController.php`](../../../red.bg/workspace-ecommerce/services/admin/app/Http/Controllers/Admin/Settings/StorefrontBasicController.php)
- [red.bg ``](../../../red.bg/workspace-ecommerce/services/storefront/basic/resources/views/layouts/partials/)
- [Holita `apps/storefront/src/main.ts:78`](../../holita/apps/storefront/src/main.ts#L78)
- [Holita `apps/admin/src/shop-settings/shop-settings-page.ts:67`](../../holita/apps/admin/src/shop-settings/shop-settings-page.ts#L67)
