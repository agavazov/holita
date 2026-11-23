# 284 Apply an approved customer data erasure request

**Status:** Blocked. Waits for customer removal, data export and approved retention policy. **Product:** Holita.

**Depends on** [214](214-holita-customer-removal.md), [282](282-holita-customer-data-export.md), [283](283-holita-customer-data-retention-policy.md).

## Background

The red.bg coverage report marks CU14 as P1. The DSAR action needs the owner-approved rules and the independently scoped customer removal and export operations.

## Goal

Apply an approved customer data erasure request.

## Steps

1. Add the authorized erasure or anonymization action for one verified customer within one Tenant and Branch.
2. Preserve the required snapshots and write the scoped outcome using the DSAR audit record.

## Done when

An approved request affects only the intended customer and Branch, and retained documents remain usable under the approved policy.

## Limits

Use only the transformations approved in ticket 283. Keep ordinary removal under ticket 214.

## References

- [red.bg `CustomerDataController.php`](../../../red.bg/workspace-ecommerce/services/api/app/Http/Controllers/Api/Admin/Customers/CustomerDataController.php)
- [red.bg `DataSubjectService.php`](../../../red.bg/workspace-ecommerce/services/api/app/Services/Privacy/DataSubjectService.php)
- [Holita `apps/commerce/src/customers/shopper.repository.ts:38`](../../holita/apps/commerce/src/customers/shopper.repository.ts#L38)
- [Holita `apps/commerce/prisma/schema.prisma:701`](../../holita/apps/commerce/prisma/schema.prisma#L701)
