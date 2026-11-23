# 261 Bound the public shop resolution cache

**Status:** Ready. **Product:** Holita.

## Background

The process retains a cache entry for every well-formed Branch ID requested, including IDs that resolve to no shop. An expired entry still occupies memory if that key is never requested again.

## Goal

Keep public shop resolution bounded while preserving the current resolution and error behaviour.

## Steps

1. Remove expired entries and cap the total number of retained lookups, including negative results. Reuse the current short freshness window.
2. Verify that repeated requests to one shop reuse a fresh lookup and that a growing number of distinct IDs cannot grow the cache indefinitely.

## Done when

Expired entries are removed, the cache stays within its cap, and Commerce continues to reject missing shops and fail closed when it needs an unavailable Core lookup.

## Limits

Use the current per-process cache and Core Branch resolver. Keep the existing freshness and scope rules.

## References

- [red.bg storefront API routes](../../../red.bg/workspace-ecommerce/services/api/routes/api/v1/storefront.php)
- [Holita public shop cache](../../holita/apps/commerce/src/storefront.service.ts#L66)
- [Holita Branch resolution](../../holita/apps/commerce/src/storefront.service.ts#L243)
- [Core public Branch lookup](../../osnova/apps/core/src/modules/branches/branches.repository.ts#L21)
