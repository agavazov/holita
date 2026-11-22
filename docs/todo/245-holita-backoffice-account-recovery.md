# 245 Recover a selected operator account

**Status:** Needs owner. Confirm the account recovery, credential delivery and session revocation policy. **Product:** Holita. Depends on [237](237-holita-backoffice-merchant-contact.md), [244](244-holita-backoffice-staff-accounts.md).

## Background

red.bg allows authorized officers to replace a merchant or officer password as a separate account operation and revokes old sessions. Core's existing password change is self-service.

## Goal

Give platform administrators an approved recovery flow for an explicitly selected account.

## Steps

1. Confirm permitted targets and the recovery proof and delivery policy. Add the narrowly scoped Core action and revoke old sessions as required.
2. Add a separate, auditable Backoffice action for the selected merchant or staff account.

## Done when

A permitted recovery affects only the selected account, and unauthorized callers cannot initiate it.

## Limits

Never expose an existing password. No provider integration.

## References

- [red.bg account management](../../../red.bg/workspace-ecommerce/services/api/app/Services/Operations/BackofficeManagementService.php)
- [Core user contract](../../osnova/apps/core/src/modules/tenants/tenants.graphql)
