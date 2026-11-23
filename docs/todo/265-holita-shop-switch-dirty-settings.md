# 265 Protect unsaved General settings when switching shops

**Status:** Ready. **Product:** Holita.

## Background

Changing Sofia's public shop name without saving, then switching to Plovdiv, drops the draft without confirmation. The shop picker stays on the same route and bypasses the page's navigation guard. The analysis report reproduced this in Admin.

## Goal

Ask whether to discard unsaved General settings before switching the active Branch.

## Steps

1. Pass a shop change from General settings through the existing dirty-form confirmation before committing the new selection or rebuilding shop-scoped data.
2. Verify cancellation, confirmed discard and a clean form in Admin.

## Done when

Cancelling the prompt leaves the original Branch, picker selection and draft intact. Confirming discards the draft and opens the selected shop's saved settings. Switching with a clean form proceeds without a prompt.

## Limits

Reuse the existing confirmation pattern and keep the scope to General settings and the shop-switch entry point.

## References

- [red.bg General settings](../../../red.bg/workspace-ecommerce/services/admin/app/Http/Controllers/Admin/Settings/GeneralController.php)
- [Holita operator shop switch](../../holita/packages/operator/src/application.ts#L196)
- [Holita Admin routes](../../holita/apps/admin/src/main.ts#L376)
- [Holita General settings draft](../../holita/apps/admin/src/shop-settings/shop-settings-page.ts#L104)
