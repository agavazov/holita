# 244 Manage platform staff accounts in Backoffice

**Status:** Ready. **Product:** Holita.

## Background

red.bg Backoffice has a staff directory and officer account editor. Holita Backoffice routes currently expose merchants only. Core already has user reads and writes.

## Goal

Let authorized platform administrators view, create and manage staff users within the platform Tenant.

## Steps

1. Use Core's scoped account and role contract for a Backoffice staff list and editor. Support the approved deactivation path and ensure an operator cannot disable their own active access from this flow.
2. Add localized form and list feedback using shared operator patterns. Link staff accounts from the existing Backoffice navigation or home.

## Done when

A platform administrator can manage a staff account while merchants and ordinary staff lack write access.

## Limits

Platform staff only. Do not add a Holita-specific identity model.

## References

- [red.bg officers](../../../red.bg/workspace-ecommerce/services/backoffice/app/Http/Controllers/Backoffice/System/OfficersController.php)
- [Core user contract](../../osnova/apps/core/src/modules/tenants/tenants.graphql)
- [Holita Backoffice entry](../../holita/apps/backoffice/src/main.ts)
