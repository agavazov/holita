# 120 Admin customer detail

**Status:** Ready. **Product:** Holita.

## Background

red.bg connects customer profile, addresses and order history in Admin.

## Goal

Merchants can see and maintain the contact details needed to serve a customer.

## Steps

1. Extend the Customer record with optional phone and shop-scoped saved addresses. Keep recipient,
   street, city, postal code and country.
2. Add the Admin Customer Detail page with a contact drawer, saved address editing and links to
   scoped order details.
3. Keep storefront sign-in and checkout behavior. Seed a phone and saved address on a new demo
   customer and link an additional demo order to that customer.

## Done when

A merchant can open a customer from the list, update contact details and addresses and reach their
orders.

## Limits

Profile and address management here is operator-facing. Existing orders retain their snapshots.

## References

- [Holita feature skill](../../.agents/skills/holita-feature/SKILL.md)
- [Customer address service](../../../red.bg/workspace-ecommerce/services/api/app/Services/Customers/CustomerAddressService.php)
- [Customer model](../../../red.bg/workspace-ecommerce/services/api/app/Models/Main/Customers/Customer.php)
- [Admin Customers](../../../red.bg/workspace-ecommerce/services/admin/resources/views/admin/customers/customers)
