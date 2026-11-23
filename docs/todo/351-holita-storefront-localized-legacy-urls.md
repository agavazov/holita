# 351 Decide which legacy locale-prefixed storefront URLs to preserve

**Status:** Needs owner. Which legacy locale-prefixed URLs should keep working for the pilot shops, and should they select the URL's language? **Product:** Holita.

**Depends on** [180](180-holita-shop-locales.md), [190](190-holita-shop-domain-aliases.md).

## Background

The red.bg coverage report marks SE04 as P2. Basic supports a remembered BG or EN selection. The source also has locale-prefixed public paths that may already be indexed.

## Goal

Decide which legacy locale-prefixed storefront URLs to preserve.

## Steps

1. Confirm the old public paths in the pilot migration and document the approved canonical and language-selection behavior.
2. Resolve the approved prefixes through current Basic language and routing rules.

## Done when

Approved old links open the intended current content and language, and their canonical public destination is consistent.

## Limits

Limit this to identified legacy locale paths. Generic redirect configuration remains separately deferred.

## References

- [red.bg `LocalesController.php`](../../../red.bg/workspace-ecommerce/services/admin/app/Http/Controllers/Admin/Settings/LocalesController.php)
- [red.bg `LocalesController.php`](../../../red.bg/workspace-ecommerce/services/api/app/Http/Controllers/Api/Admin/Settings/LocalesController.php)
- [Holita `apps/storefront/src/main.ts:919`](../../holita/apps/storefront/src/main.ts#L919)
- [Holita `apps/storefront/src/main.ts:121`](../../holita/apps/storefront/src/main.ts#L121)
