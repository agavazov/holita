# 190 Verify a storefront alias for the selected shop

**Status:** Needs owner. Approve hosting, DNS proof, TLS ownership and canonical URL policy. **Product:** Holita.

## Background

red.bg Admin manages verified custom storefront domains. Holita resolves shops under /s/<branchId> on one origin.

## Goal

Let a merchant register and verify an alias for one Branch once hosting and canonical URL policy are approved.

## Steps

1. Confirm the approved hosting, domain eligibility, DNS proof and canonical URL policy before enabling the alias flow.
2. Add scoped pending, verified and removed records and Admin actions. Bind verification and uniqueness to the proposed hostname, verified Tenant and Branch.

## Done when

A merchant can prove control for their shop's pending alias, and another shop cannot claim the verified hostname.

## Limits

Alias records and proof verification only. Host resolution, ingress and TLS belong to 253.

## References

- [red.bg custom domain service](../../../red.bg/workspace-ecommerce/services/api/app/Services/Stores/CustomDomainService.php)
- [red.bg domain routes](../../../red.bg/workspace-ecommerce/services/admin/routes/admin.php)
- [Holita shop routing policy](../../holita/AGENTS.md)
