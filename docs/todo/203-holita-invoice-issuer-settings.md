# 203 Save invoice issuer defaults

**Status:** Ready. **Product:** Holita.

## Background

red.bg Admin has invoice settings. Holita Order Invoice requires the issuer details for each new invoice and snapshots them at issue.

## Goal

Let merchants save their issuer identity once per shop.

## Steps

1. Store defaults for the issuer identity fields already accepted by invoice issue, within the selected Tenant and Branch. Add an Admin Invoice Settings form.
2. Prefill the existing issue drawer from the saved defaults. Preserve issuer values already stored on invoices.

## Done when

The next invoice form uses the selected shop's issuer defaults. A merchant can complete or override those fields before issue, and changing the defaults leaves issued snapshots intact.

## Limits

Issuer identity only. Keep current numbering and issue rules.

## References

- [red.bg invoices settings](../../../red.bg/workspace-ecommerce/services/admin/app/Http/Controllers/Admin/Documents/InvoicesController.php)
- [Holita invoice issue drawer](../../holita/apps/admin/src/orders/invoice-editor.ts)
- [Holita issuer input](../../holita/apps/commerce/src/commerce.graphql#L814)
- [Holita invoice issue action](../../holita/apps/admin/src/orders/invoice-editor.ts#L251)
