# 124 Shop blog

**Status:** Ready. **Product:** Holita.

## Background

red.bg provides merchant-managed articles and tags, with a public blog.

## Goal

Merchants publish shop articles and shoppers can browse them.

## Steps

1. Keep slug, BG/EN title and body, draft or published status, publication time and reusable tag
   names and slugs.
2. Add Admin Blog Articles and Tags lists and drawers. Add public blog list, tag filter and
   article routes under the shop. Order published articles by publication time.
3. Seed two published articles with a shared tag and one draft.

## Done when

A merchant can publish and tag an article, and the public list and tag filter exclude drafts.

## Limits

Use plain text content. Scheduled publishing and comments are outside this slice.

## References

- [Holita feature skill](../../.agents/skills/holita-feature/SKILL.md)
- [Blog post service](../../../red.bg/workspace-ecommerce/services/api/app/Services/Content/BlogPostService.php)
- [Blog tag service](../../../red.bg/workspace-ecommerce/services/api/app/Services/Content/BlogTagService.php)
- [Admin Blog](../../../red.bg/workspace-ecommerce/services/admin/resources/views/admin/blog)
- [Basic Blog](../../../red.bg/workspace-ecommerce/services/storefront/basic/resources/views/storefront/blog)
