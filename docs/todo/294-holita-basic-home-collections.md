# 294 Show collections and recent products on the Basic home page

**Status:** Ready. **Product:** Holita.

**Depends on** [188](188-holita-basic-home-content.md).

## Background

The red.bg coverage report marks ST04 as P2. Collections currently have their own storefront views. The source can show them on the homepage and falls back to recent products.

## Goal

Show collections and recent products on the Basic home page.

## Steps

1. Use the existing public collection and catalogue reads to render linked product rows for eligible home collections.

## Done when

Basic shows available shop collections with links to their full results, and a shop without eligible collections shows its newest public products.

## Limits

Reuse existing product cards. Keep merchandising rules and theme engines outside this run.

## References

- [red.bg `StorefrontController.php`](../../../red.bg/workspace-ecommerce/services/storefront/basic/app/Http/Controllers/StorefrontController.php)
- [red.bg `StorefrontHomeView.php`](../../../red.bg/workspace-ecommerce/services/storefront/basic/app/Services/Storefront/StorefrontHomeView.php)
- [Holita `apps/storefront/src/catalogue-browse.ts:36`](../../holita/apps/storefront/src/catalogue-browse.ts#L36)
- [Holita `apps/commerce/src/collections/collections.service.ts:102`](../../holita/apps/commerce/src/collections/collections.service.ts#L102)
