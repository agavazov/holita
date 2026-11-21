# 123 Shop content pages

**Status:** Ready after [102](102-holita-demo-shop.md). **Product:** Holita.

## Background

red.bg serves merchant-authored pages through Basic.

## Goal

Merchants publish shop information pages in Bulgarian and English.

## Steps

1. Keep a shop-unique slug, BG/EN titles and bodies, and draft or published status.
2. Add the Admin Pages list and drawer. Serve only published pages in the storefront graph and
   render them at the shop’s page URL with a language fallback.
3. Seed a published About Us page, a published Delivery Information page and one draft.

## Done when

A merchant can publish a page and open its storefront URL. A draft is absent from public reads.

## Limits

Use plain text content and one slug per page. Menu links land in 125.

## References

- [Holita feature skill](../../.agents/skills/holita-feature/SKILL.md)
- [Page service](../../../red.bg/workspace-ecommerce/services/api/app/Services/Content/PageService.php)
- [Admin Pages](../../../red.bg/workspace-ecommerce/services/admin/resources/views/admin/pages)
- [Basic content page](../../../red.bg/workspace-ecommerce/services/storefront/basic/resources/views/storefront/page.blade.php)
