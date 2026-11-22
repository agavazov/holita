# 246 Open the selected shop in a staff support session

**Status:** Needs owner. Approve delegated Admin operations, staff roles and audit requirements. **Product:** Holita. Depends on [238](238-holita-backoffice-shop-directory.md).

## Background

red.bg Backoffice can enter merchant Admin through a separate authorized impersonation session. Holita platform staff can view merchant and Branch metadata, with no explicit Admin support context.

## Goal

Let an approved staff role access the selected shop's Admin for support.

## Steps

1. Confirm permitted roles, actions and duration. Bind delegated access to the chosen Tenant and Branch and retain the real staff identity in audit data.
2. Add start and stop actions and a visible support context in Admin. Keep scope validation on each Commerce request.

## Done when

A permitted staff user enters and exits exactly the selected shop, and the actual actor remains identifiable.

## Limits

Merchant Admin support only. Shopper support has separate permissions.

## References

- [red.bg Backoffice impersonation](../../../red.bg/workspace-ecommerce/services/backoffice/app/Http/Controllers/Backoffice/Stores/StoreImpersonationController.php)
- [red.bg auth service](../../../red.bg/workspace-ecommerce/services/api/app/Services/Auth/AuthImpersonationService.php)
- [Holita operator shell](../../holita/packages/operator/src/application.ts)
