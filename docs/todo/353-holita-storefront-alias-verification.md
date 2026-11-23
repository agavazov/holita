# 353 Register and verify a merchant storefront alias

**Status:** Blocked. Waits for the approved domain policy in [190](190-holita-shop-domain-aliases.md). **Product:** Holita.

## Background

red.bg lets an eligible merchant add a custom domain, verify its DNS proof and remove it. Holita serves Basic under the existing Branch path and has no verified alias records.

## Goal

Let an eligible merchant prove control of a hostname for one Branch and withdraw that alias when needed.

## Steps

1. Add scoped pending, verified and withdrawn alias records and authorized Admin actions for one Branch under the 190 policy.
2. Verify the approved DNS proof against the normalized hostname and bind it to the verified Tenant and Branch. Apply the agreed uniqueness and withdrawal rules and expose the verified result for routing in 253.

## Done when

An eligible merchant can see a pending alias, promote it after presenting valid proof and withdraw it. A wrong proof, a claim on an already verified hostname or an action outside the merchant's scope is refused.

## Limits

Reuse the current operator graph and Branch scope. Ingress and TLS deployment, canonical URLs and serving a Branch on the alias are covered by 253.

## References

- [red.bg Admin custom domains](../../../red.bg/workspace-ecommerce/services/admin/app/Http/Controllers/Admin/Settings/CustomDomainsController.php)
- [red.bg custom domain verification](../../../red.bg/workspace-ecommerce/services/api/app/Services/Stores/CustomDomainService.php)
- [Holita shop settings](../../holita/apps/admin/src/shop-settings/shop-settings-page.ts#L77)
- [Holita current Branch route](../../holita/apps/storefront/src/main.ts#L919)
