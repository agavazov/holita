# 253 Route verified storefront hosts to their Branch

**Status:** Blocked. Waiting for verified aliases in [353](353-holita-storefront-alias-verification.md) and the approved policy in 190. **Product:** Holita.

## Background

Ticket 353 handles storefront alias verification under the policy in 190. Holita currently resolves the Branch from its /s/<branchId> route.

## Goal

Serve the Basic shop on an approved verified host under the chosen ingress and canonical URL rules.

## Steps

1. Resolve the normalized host against verified alias records only, and use the resolved Branch for public reads. Preserve the existing Branch path and apply the approved canonical URL policy.
2. Wire the approved ingress and TLS ownership arrangement. Advertise the canonical hostname for any sitemap delivered by 228 when canonical routing becomes active. Exercise verified, unverified, revoked and mismatched hosts.

## Done when

A verified live alias opens only its assigned shop with the approved canonical URL. Revoked or unverified hosts cannot resolve a shop.

## Limits

Host routing only. Verification UI and DNS proof stay in 353.

## References

- [red.bg custom domain service](../../../red.bg/workspace-ecommerce/services/api/app/Services/Stores/CustomDomainService.php)
- [Holita shop resolution](../../holita/apps/storefront/src/main.ts)
- [Holita shop routing policy](../../holita/AGENTS.md)
- [Holita current storefront routes](../../holita/apps/storefront/src/main.ts#L919)
