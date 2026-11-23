# 336 Write and render limited formatting in shop pages and articles

**Status:** Ready. **Product:** Holita.

## Background

The red.bg coverage report marks CN03 as P2. Pages and articles currently use plain text. The source supports formatted content and validates it before publication.

## Goal

Write and render limited formatting in shop pages and articles.

## Steps

1. Reuse a limited editor for pages and articles, with an explicit allowed set of formatting, links and approved local images. Sanitize the submitted representation in Commerce.

## Done when

Existing plain text remains readable, and a new published page or article shows approved formatting without rendering executable content.

## Limits

Use the existing content editors and Basic routes. Keep theme editing and remote media ingestion out.

## References

- [red.bg `PageService.php`](../../../red.bg/workspace-ecommerce/services/api/app/Services/Content/PageService.php)
- [red.bg `PageContentSanitizationTest.php`](../../../red.bg/workspace-ecommerce/services/api/tests/Database/PageContentSanitizationTest.php)
- [Holita `apps/commerce/src/content-validation.ts:8`](../../holita/apps/commerce/src/content-validation.ts#L8)
- [Holita `apps/admin/src/pages/page-editor.ts:62`](../../holita/apps/admin/src/pages/page-editor.ts#L62)
