# 283 Decide the customer data erasure and retention policy

**Status:** Needs owner. Who can approve a verified erasure request, and which customer records and issued snapshots must be kept and for how long? **Product:** Holita.

## Background

The red.bg coverage report marks CU14 as P1. Customer account removal, personal-data erasure and preservation of issued documents are different operations.

## Goal

Decide the customer data erasure and retention policy.

## Steps

1. Record the approved requester verification, authorization, retention periods, allowed anonymization, and the audit fields to keep.
2. Define which records can be erased and which document snapshots have to remain available after a request.

## Done when

The owner-approved rules identify how to handle each customer and document record and can be applied in ticket 284.

## Limits

Decision only. Apply existing owner exclusions for integrations and send no data externally.

## References

- [red.bg `CustomerDataController.php`](../../../red.bg/workspace-ecommerce/services/api/app/Http/Controllers/Api/Admin/Customers/CustomerDataController.php)
- [red.bg `DataSubjectService.php`](../../../red.bg/workspace-ecommerce/services/api/app/Services/Privacy/DataSubjectService.php)
- [Holita `apps/commerce/prisma/schema.prisma:701`](../../holita/apps/commerce/prisma/schema.prisma#L701)
- [Holita `apps/commerce/src/customers/shopper.repository.ts:38`](../../holita/apps/commerce/src/customers/shopper.repository.ts#L38)
