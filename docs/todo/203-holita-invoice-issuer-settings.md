# 203 Save invoice issuer defaults

**Status:** Ready. **Product:** Holita.

## Background

red.bg Admin has invoice settings. Holita Order Invoice requires the issuer details for each new invoice and snapshots them at issue.

## Goal

Let merchants save their issuer identity once per shop.

## Steps

1. Store the supported shop issuer fields in Commerce and add an Admin Invoice Settings form.
2. Prefill the existing issue drawer from the saved defaults. Preserve issuer values already stored on invoices.

## Done when

Changing defaults changes the next invoice form only and never changes issued documents.

## Limits

Issuer identity only. Keep current numbering and issue rules.

## References

- [red.bg invoices settings](../../../red.bg/workspace-ecommerce/services/admin/app/Http/Controllers/Admin/Documents/InvoicesController.php)
- [Holita invoice issue drawer](../../holita/apps/admin/src/orders/invoice-editor.ts)
