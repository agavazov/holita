# 158 Localize operator request failures

**Status:** Ready after [155](155-holita-merchant-detail-states.md). **Product:** Holita.

## Background

The Holita sign-in shell, Products list and Backoffice merchant screens use requestError. The helper can return a GraphQL message verbatim, including Core's English invalid-credentials message in Bulgarian.

## Goal

Use localized operator text for these request failures and retain request IDs for support.

## Steps

1. Map known sign-in and operation failures to the selected language and use a localized fallback for unclassified catalogue and Backoffice requests. Keep request identification separate from service text.
2. Preserve actionable localized validation where the affected form already maps field errors.

## Done when

An injected GraphQL request failure displays Bulgarian or English UI copy according to the selected language, with the request ID when present.

## Limits

Limit changes to affected Holita callers. Keep shared request handling and service messages intact.

## References

- [Products list](../../holita/apps/admin/src/products/products-page.ts)
- [Merchants list](../../holita/packages/operator/src/merchants-page.ts)
- [Merchant detail](../../holita/packages/operator/src/merchant-detail-page.ts)
- [Request message helper](../../osnova/packages/ui/src/app/graphql/request-error.ts)
- [Holita sign-in shell](../../holita/packages/operator/src/application.ts)
