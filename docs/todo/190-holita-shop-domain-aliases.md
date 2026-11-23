# 190 Decide the storefront alias and canonical URL policy

**Status:** Needs owner. Which shops may use aliases, which DNS proof and TLS/ingress setup should they use, and which URL is canonical? **Product:** Holita.

## Background

red.bg Admin manages verified custom storefront domains. Holita resolves shops under /s/<branchId> on one origin.

## Goal

Set the rules for a merchant to use their own domain for one shop.

## Steps

1. Record which shops may use aliases, the required DNS ownership proof and how adding or withdrawing a domain affects eligibility.
2. Agree on ingress and TLS ownership, the canonical public address and the behavior of existing Branch URLs and inbound links. Give 353 and 253 a single policy to implement.

## Done when

The owner has approved concrete rules for domain eligibility, proof, expiry or withdrawal, TLS and canonical URLs, including how a released domain and existing shop links are handled.

## Limits

Policy decision only. Alias records and proof verification follow in 353. Host resolution, ingress and TLS follow in 253.

## References

- [red.bg custom domain service](../../../red.bg/workspace-ecommerce/services/api/app/Services/Stores/CustomDomainService.php)
- [red.bg domain routes](../../../red.bg/workspace-ecommerce/services/admin/routes/admin.php)
- [Holita shop routing policy](../../holita/AGENTS.md)
- [red.bg Admin custom domain actions](../../../red.bg/workspace-ecommerce/services/admin/app/Http/Controllers/Admin/Settings/CustomDomainsController.php)
- [Holita Branch path](../../holita/apps/storefront/src/main.ts#L919)
