# 229 Scope parity for shop redirect rule APIs

**Status:** Needs owner. Which API caller and approved internal shop paths, if any, should use redirect rules during a migration? **Product:** Holita.

## Background

red.bg implements rule writes in its merchant API and a public resolver. The reviewed Admin and Basic routes do not wire these into a user workflow.

## Goal

If API parity is explicitly approved, expose scoped rule writes and a resolution contract.

## Steps

1. Confirm the API caller, supported shop paths and whether each supported path needs a permanent or temporary redirect.
2. Implement verified Tenant and Branch rule management and resolution for approved internal shop paths.

## Done when

An authorized API caller can save and resolve an approved rule in its own shop. Rules cannot affect another shop.

## Limits

Deferred API scope only. Keep an Admin editor and Basic redirect behavior out of screen migration.

## References

- [red.bg redirect API](../../../red.bg/workspace-ecommerce/services/api/routes/api/v1/admin.php#L258)
- [red.bg resolver](../../../red.bg/workspace-ecommerce/services/api/app/Services/Storefront/StorefrontRedirectResolver.php)
- [Basic storefront routes](../../holita/apps/storefront/src/main.ts#L918)
