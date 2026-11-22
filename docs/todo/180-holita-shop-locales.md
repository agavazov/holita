# 180 Configure storefront languages by shop

**Status:** Ready. **Product:** Holita.

## Background

red.bg supports enabling storefront languages and selecting the shop default. Holita has a BG/EN toggle with Bulgarian as the initial fallback for every shop.

## Goal

Let merchants choose the default and available storefront languages.

## Steps

1. Store enabled BG/EN languages and a default per Branch. Keep the default enabled.
2. Add the Admin setting and apply the public configuration to fresh visits and remembered preferences. Offer a switch when both languages are enabled.

## Done when

Different shops can select different defaults, and an unsupported remembered preference falls back to the selected shop default.

## Limits

Configure the two supported languages. Keep operator language independent and retain the current shop route.

## References

- [red.bg locale editor](../../../red.bg/workspace-ecommerce/services/admin/app/Http/Controllers/Admin/Settings/LocalesController.php)
- [Storefront locale source](../../holita/apps/storefront/src/main.ts)
- [Storefront schema](../../holita/apps/commerce/src/storefront.graphql)
