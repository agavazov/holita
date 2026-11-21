# 126 General shop settings

**Status:** Ready after [102](102-holita-demo-shop.md). **Product:** Holita.

## Background

red.bg exposes merchant-editable public shop information in General Settings.

## Goal

Merchants can set their storefront display and contact details.

## Steps

1. Keep a public display name, contact email, phone and address in one scoped Commerce settings
   record. Fall back to the Branch name when no display name is set.
2. Add an Admin General Settings screen with a drawer for edits. Expose the public fields on the
   basic storefront shell and contact page.
3. Seed a display name and fictional Bulgarian contact details for the demo shop.

## Done when

Saving General Settings updates the storefront for the selected shop only.

## Limits

Keep routing, operator identity, currency and provider configuration out of this form.

## References

- [Holita feature skill](../../.agents/skills/holita-feature/SKILL.md)
- [General settings service](../../../red.bg/workspace-ecommerce/services/api/app/Services/Settings/GeneralSettingsService.php)
- [Public contact settings](../../../red.bg/workspace-ecommerce/services/api/app/Services/Settings/StoreSettingsService.php)
- [Admin settings form](../../../red.bg/workspace-ecommerce/services/admin/resources/views/admin/settings/general/partials/form.blade.php)
- [Basic contacts](../../../red.bg/workspace-ecommerce/services/storefront/basic/resources/views/storefront/contacts.blade.php)
