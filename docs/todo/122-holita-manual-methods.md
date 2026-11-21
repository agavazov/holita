# 122 Admin manual payment and shipping methods

**Status:** Ready after [115](115-holita-checkout-quote.md), [118](118-holita-admin-order-management.md). **Product:** Holita.

## Background

red.bg has implemented payment and shipping method screens with activation controls.

## Goal

Merchants manage the manual options already used by checkout.

## Steps

1. Add Admin Payment Methods and Shipping Methods lists and drawers over the existing models. Edit
   label, active status, order, payment instructions and the fixed shipping fee.
2. Let merchants add, edit and deactivate methods. Have checkout show the current enabled options
   and preserve historical settings in order snapshots.
3. Seed a second enabled payment method and an inactive delivery option.

## Done when

The merchant can change availability and fees, checkout shows those changes, and old order
snapshots stay readable.

## Limits

Manual methods only. Deactivation is sufficient for methods already used by orders.

## References

- [Holita feature skill](../../.agents/skills/holita-feature/SKILL.md)
- [Payment settings form](../../../red.bg/workspace-ecommerce/services/admin/resources/views/admin/settings/payment-methods/form.blade.php)
- [Shipping settings form](../../../red.bg/workspace-ecommerce/services/admin/resources/views/admin/settings/shipping-methods/form.blade.php)
- [Fixed rate driver](../../../red.bg/workspace-ecommerce/services/api/app/Services/Shipping/InternalFixedRateDriver.php)
