# 214 Define supported removal of a shop customer

**Status:** Needs owner. Under the retention policy, should a merchant remove the customer account or revoke access and keep the account record? Depends on [283](283-holita-customer-data-retention-policy.md). **Product:** Holita.

## Background

red.bg Admin has a customer removal action. Holita currently edits customer details and retains order records.

## Goal

Give merchants an approved way to remove a shop account while retaining required historical records.

## Steps

1. Confirm the merchant account action and use 283 for retention of credentials, addresses, customer content and order snapshots.
2. Implement the approved scoped removal and confirmed Admin action, including invalidating access where relevant.

## Done when

The customer can no longer use the removed account and retained orders follow the approved retention policy.

## Limits

Shop account removal only. Keep platform identity and external privacy integrations out.

## References

- [red.bg customer routes](../../../red.bg/workspace-ecommerce/services/admin/routes/admin.php)
- [Holita customer detail](../../holita/apps/admin/src/customers/customer-detail.html)
