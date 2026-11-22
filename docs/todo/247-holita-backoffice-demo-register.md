# 247 Manage demo records in Backoffice

**Status:** Ready. **Product:** Holita.

## Background

red.bg Backoffice has a demo register with active status, dates, assigned staff and internal notes. Holita has a seeded demo shop without a staff-managed register.

## Goal

Give platform staff a scoped register for their operational demo records.

## Steps

1. Add product-owned platform demo records with the supported date, number, assignee and notes. Reuse Core staff IDs for assignment.
2. Add Backoffice list, view and editor with localized states and link the register from the existing Backoffice navigation or home. Keep demo notes off public storefront reads.

## Done when

Authorized staff can create, find and update a demo record.

## Limits

Demo records only. No copying or provisioning shops, Sales handoff or external services.

## References

- [red.bg demos controller](../../../red.bg/workspace-ecommerce/services/backoffice/app/Http/Controllers/Backoffice/System/DemosController.php)
- [red.bg platform operations](../../../red.bg/workspace-ecommerce/services/api/app/Services/Operations/BackofficeSystemService.php)
- [Holita Backoffice shell](../../holita/apps/backoffice/src/main.ts)
