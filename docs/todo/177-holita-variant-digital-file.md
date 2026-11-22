# 177 Attach a private versioned digital file through the catalogue API

**Status:** Blocked. Deferred pending explicit approval to migrate the API-only attachment workflow. **Product:** Holita.

## Background

red.bg merchant catalogue API implements private digital-file assignment to a variant. Its Admin routes have no attachment editor. Holita has public catalogue media only.

## Goal

If API parity is approved, support a merchant attaching, reading metadata for, replacing or removing a scoped private file.

## Steps

1. Add authorized API operations and private local storage. Give uploaded bytes a stable immutable version identity and preserve an established attachment during ordinary product and variant edits.
2. Change only the active attachment on explicit replacement or removal. Preserve versions referenced by earned downloads under the agreed local retention rule.

## Done when

An authorized API client can manage a shop variant attachment, an ordinary variant save leaves the association intact, and anonymous requests cannot fetch the file.

## Limits

Deferred API scope only. Keep new Admin screens out of migration parity.

## References

- [red.bg merchant digital-file API](../../../red.bg/workspace-ecommerce/services/api/app/Http/Controllers/Api/Admin/Catalog/DigitalFilesController.php)
- [Holita variant persistence](../../holita/apps/commerce/src/products/commerce.repository.ts)
