# 240 Remove a merchant with no shops

**Status:** Needs owner. Confirm retention and removal permissions for merchant accounts. **Product:** Holita. Depends on [237](237-holita-backoffice-merchant-contact.md).

## Background

red.bg exposes guarded merchant deletion and rejects merchants that still have shops. Holita offers suspend/reactivate.

## Goal

Allow authorized Backoffice staff to remove an eligible unused merchant under the approved retention rule.

## Steps

1. Confirm treatment of merchant operator accounts and the audit record. Enforce the zero-Branch guard in Core.
2. Add a confirmed action and report a dependency conflict without deleting any records.

## Done when

An eligible empty merchant follows the approved removal path and a merchant with shops is rejected.

## Limits

Merchant deletion only. Never cascade into shop data.

## References

- [red.bg guarded merchant deletion](../../../red.bg/workspace-ecommerce/services/api/app/Services/Merchants/MerchantDeletionService.php)
- [Holita merchant detail](../../holita/packages/operator/src/merchant-detail-page.ts)
