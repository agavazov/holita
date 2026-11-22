# 191 Define merchant self-registration and approval

**Status:** Needs owner. Confirm public merchant signup and the approval policy. **Product:** Holita.

## Background

red.bg accepts self-registration into an unapproved merchant state and Admin shows a waiting screen. Holita merchants come from Backoffice provisioning or the queued Sales handoffs.

## Goal

Add the owner-approved path for a prospective merchant to apply and await approval.

## Steps

1. Confirm if this release accepts public merchant applications and who approves them. Model a pending state that grants no storefront or merchant operator access.
2. Add a signup/waiting flow and authorized approve/reject actions. Use existing merchant provisioning once approved.

## Done when

An approved applicant can enter merchant Admin, and a pending or declined application cannot access merchant operations.

## Limits

No social identity provider, paid plans or changes to queued Sales provisioning.

## References

- [red.bg registration service](../../../red.bg/workspace-ecommerce/services/api/app/Services/Merchants/MerchantRegistrationService.php)
- [red.bg Admin waiting and signup routes](../../../red.bg/workspace-ecommerce/services/admin/routes/admin.php)
- [Core platform service](../../osnova/apps/core/src/modules/platform/platform.service.ts)
