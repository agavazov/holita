# 321 Record a customer communication language

**Status:** Ready. **Product:** Holita.

## Background

The red.bg coverage report marks CU03 as P2. The customer record does not carry a preferred language for merchant communications.

## Goal

Record a customer communication language.

## Steps

1. Let Admin persist a supported preferred language in the scoped customer contact editor and use it for localized transactional templates.

## Done when

A customer can have a persisted BG or EN preference, and a supported local notice uses it while legacy records use the existing fallback.

## Limits

Keep changes within the supported locales and local transactional delivery path.

## References

- [red.bg `CustomersController.php`](../../../red.bg/workspace-ecommerce/services/admin/app/Http/Controllers/Admin/Customers/CustomersController.php)
- [red.bg `filters.blade.php`](../../../red.bg/workspace-ecommerce/services/admin/resources/views/admin/customers/customers/partials/filters.blade.php)
- [Holita `apps/commerce/src/customers/customers.service.ts:73`](../../holita/apps/commerce/src/customers/customers.service.ts#L73)
- [Holita `apps/admin/src/customers/customer-contact-editor.ts:44`](../../holita/apps/admin/src/customers/customer-contact-editor.ts#L44)
