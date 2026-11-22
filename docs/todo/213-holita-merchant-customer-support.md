# 213 Support an authorized shopper session from Admin

**Status:** Needs owner. Approve delegated shopper access, permitted actions and audit policy. **Product:** Holita.

## Background

red.bg has a merchant-initiated login-as flow for a selected customer. Holita only supports ordinary shopper sign-in.

## Goal

Provide an owner-approved way for a merchant to diagnose a shopper-account issue.

## Steps

1. Confirm the roles, allowed actions, duration and audit requirements. Design the support context around the selected Tenant, Branch and customer.
2. Provide the Admin start and storefront stop actions with a visible support indicator, keeping support sessions distinct from customer credentials.

## Done when

An approved merchant can start and stop access for a customer in their shop, and the recorded actor remains identifiable.

## Limits

Keep Backoffice merchant support separate. No credential disclosure.

## References

- [red.bg customer support](../../../red.bg/workspace-ecommerce/services/admin/app/Http/Controllers/Admin/Customers/CustomerImpersonationController.php)
- [red.bg support session service](../../../red.bg/workspace-ecommerce/services/api/app/Services/Auth/AuthImpersonationService.php)
- [Holita shopper contract](../../holita/apps/commerce/src/storefront.graphql)
