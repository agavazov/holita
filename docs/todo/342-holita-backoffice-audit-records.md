# 342 Record the actual Backoffice actor on material shop changes

**Status:** Ready. **Product:** Holita.

**Depends on** [238](238-holita-backoffice-shop-directory.md), [341](341-holita-merchant-admin-audit-records.md).

## Background

The red.bg coverage report marks OPS06 as P2. Backoffice roles can manage merchants and shops. Some future actions plan their own audit, but ordinary material changes need a shared record.

## Goal

Record the actual Backoffice actor on material shop changes.

## Steps

1. Apply the established audit contract to Backoffice merchant status and shop rename actions, preserving the actual operator and affected Tenant and Branch.
2. Share the audit fields from ticket 341 without writing contact values or creating separate view tooling.

## Done when

A permitted Backoffice change records its actual staff actor, affected merchant or shop and committed outcome.

## Limits

Use verified Core identity. Leave destructive retirement, account recovery and support delegation to their own approved tickets.

## References

- [red.bg `LogOfficerActions.php`](../../../red.bg/workspace-ecommerce/services/backoffice/app/Http/Middleware/LogOfficerActions.php)
- [red.bg `RecordAdminAudit.php`](../../../red.bg/workspace-ecommerce/services/api/app/Http/Middleware/RecordAdminAudit.php)
- [Holita `packages/operator/src/merchant-detail-page.ts:105`](../../holita/packages/operator/src/merchant-detail-page.ts#L105)
- [Holita `apps/backoffice/src/main.ts:8`](../../holita/apps/backoffice/src/main.ts#L8)
