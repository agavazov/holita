# 242 Apply approved Commerce cleanup to a retired shop

**Status:** Blocked. Waiting for the approved retention rules and scope in 241. **Product:** Holita. Depends on [241](241-holita-backoffice-shop-purge-policy.md).

## Background

red.bg store purge spans records and files. The approved decisions in 241 determine which Holita Commerce records and files may be removed for a suspended Branch.

## Goal

Size and implement the Commerce cleanup only after the retention contract is approved.

## Steps

1. Translate 241 into a concrete inventory of retained and removable Commerce data and local media. Size the work against that inventory and split it further if one run is insufficient.
2. Implement the approved scoped cleanup with a recoverable completion outcome. Preserve records required by the approved retention policy.

## Done when

An interrupted cleanup can recover and only eligible data and files of the specified suspended Branch are affected.

## Limits

Commerce cleanup only. Keep Core Branch and Backoffice changes out of this step.

## References

- [red.bg isolated shop purge](../../../red.bg/workspace-ecommerce/services/api/app/Services/Operations/BackofficeStorePurgeService.php)
- [Holita Commerce schema](../../holita/apps/commerce/prisma/schema.prisma)
