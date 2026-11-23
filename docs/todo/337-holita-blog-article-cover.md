# 337 Publish a local blog article cover in Basic

**Status:** Ready. **Product:** Holita.

## Background

The red.bg coverage report marks BL03 as P2. Holita has article editing and public article views. The source also displays a merchant-maintained cover image.

## Goal

Publish a local blog article cover in Basic.

## Steps

1. Use the existing Commerce media path to upload, replace or clear the article cover and store localized alternative text.
2. Expose the cover through the current public article read and render it in the public list and detail.

## Done when

A published article can show a cover and its alternative text in both views, and old articles without covers still render.

## Limits

One local cover per article. Keep shared media libraries and inline editing separate.

## References

- [red.bg `BlogController.php`](../../../red.bg/workspace-ecommerce/services/admin/app/Http/Controllers/Admin/Blog/BlogController.php)
- [red.bg `BlogPostView.php`](../../../red.bg/workspace-ecommerce/services/storefront/basic/app/Services/Storefront/BlogPostView.php)
- [Holita `apps/admin/src/blog/blog-article-editor.ts:64`](../../holita/apps/admin/src/blog/blog-article-editor.ts#L64)
- [Holita `apps/storefront/src/storefront-blog.ts:27`](../../holita/apps/storefront/src/storefront-blog.ts#L27)
