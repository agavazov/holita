# 197 Manage saved addresses as shopper or merchant

**Status:** Ready. **Product:** Holita.

## Background

red.bg shoppers can manage their own saved addresses, and merchants can remove a customer's obsolete address in Admin. Holita Admin can add and edit addresses.

## Goal

Add shopper address self-service and the missing Admin remove action over the same scoped address model.

## Steps

1. Reuse the Commerce customer address service for shopper-owned list, create and update. Add a scoped remove operation shared by shopper and merchant entry points with each caller's existing authorization.
2. Build account address reads and forms with BG/EN states. Add a confirmed remove action to Admin Customer Detail.

## Done when

A shopper can manage only their own addresses in the selected shop. An authorized merchant can remove the chosen customer's address. Previous orders retain their delivery snapshot.

## Limits

Address book and Admin removal only. Checkout address selection follows separately.

## References

- [red.bg account controller](../../../red.bg/workspace-ecommerce/services/storefront/basic/app/Http/Controllers/AccountController.php)
- [red.bg Admin address routes](../../../red.bg/workspace-ecommerce/services/admin/routes/admin.php)
- [Holita customer detail](../../holita/apps/admin/src/customers/customer-detail.html)
- [Holita storefront contract](../../holita/apps/commerce/src/storefront.graphql)
