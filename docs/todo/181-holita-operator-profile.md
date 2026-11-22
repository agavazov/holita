# 181 Manage the signed-in operator profile

**Status:** Ready. **Product:** Holita.

## Background

red.bg has a merchant profile and password change, with an equivalent staff password workflow. Holita operator headers link Profile to the application home, even though Core exposes updateProfile and changePassword.

## Goal

Allow signed-in merchants and Backoffice staff to view their profile and change permitted account information.

## Steps

1. Add profile routes to Admin and Backoffice using shared forms and current Core account mutations.
2. Show name and email, edit the supported profile fields, and change the password with the current-credential check and localized feedback.

## Done when

Operators can open their profile from either app, persist permitted changes and change their own password through Core.

## Limits

Self-service only. Keep staff management and changes to another person's account separate.

## References

- [red.bg Admin profile](../../../red.bg/workspace-ecommerce/services/admin/app/Http/Controllers/Admin/System/ProfileController.php)
- [Holita operator shell](../../holita/packages/operator/src/application.ts)
- [Core account contract](../../osnova/apps/core/src/modules/tenants/tenants.graphql)
