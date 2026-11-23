# 282 Export a verified shop customer's records with an audit entry

**Status:** Ready. **Product:** Holita.

## Background

The red.bg coverage report marks CU13 as P1. Holita currently exposes customer and order data through regular operations. The source has a scoped personal-data export.

## Goal

Export a verified shop customer's records with an audit entry.

## Steps

1. Add an explicitly authorized operator API export of one verified customer's data and shop records as JSON, with the fields listed in the contract.
2. Record requesting actor, Tenant, Branch, customer reference and outcome without storing exported personal data in the audit record.

## Done when

An authorized operator can retrieve the intended customer's records from one Branch, and another customer's or another Branch's data is excluded.

## Limits

No erasure or retention policy change. Apply the existing verified operator authorization and scoped queries.

## References

- [red.bg `CustomerDataController.php`](../../../red.bg/workspace-ecommerce/services/api/app/Http/Controllers/Api/Admin/Customers/CustomerDataController.php)
- [red.bg `DataSubjectService.php`](../../../red.bg/workspace-ecommerce/services/api/app/Services/Privacy/DataSubjectService.php)
- [Holita `apps/commerce/src/customers/customers.service.ts:73`](../../holita/apps/commerce/src/customers/customers.service.ts#L73)
- [Holita `apps/commerce/src/orders/orders.service.ts:188`](../../holita/apps/commerce/src/orders/orders.service.ts#L188)
