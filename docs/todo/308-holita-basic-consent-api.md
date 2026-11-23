# 308 Record approved visitor consent changes in the storefront API

**Status:** Needs owner. Should Holita retain consent changes on the server, and if so which visitor identifier and retention period are approved? **Product:** Holita.

**Depends on** [307](307-holita-basic-cookie-preferences.md).

## Background

The red.bg coverage report marks ST11 as P2. red.bg exposes a consent event API. Local browser preferences are addressed separately in ticket 307.

## Goal

Record approved visitor consent changes in the storefront API.

## Steps

1. Confirm which visitor identifier, categories and retention are approved for a consent history.
2. Record a scoped change with category choice, policy version and timestamp through the public storefront graph.

## Done when

An approved change produces a Branch-scoped record with the correct version and choice without exposing another visitor's history.

## Limits

Collect only the approved fields. Exclude marketing connectors.

## References

- [red.bg `storefront.php`](../../../red.bg/workspace-ecommerce/services/api/routes/api/v1/storefront.php)
- [red.bg `ConsentLogService.php`](../../../red.bg/workspace-ecommerce/services/api/app/Services/Privacy/ConsentLogService.php)
- [Holita `apps/commerce/src/storefront.graphql:433`](../../holita/apps/commerce/src/storefront.graphql#L433)
- [Holita `apps/storefront/src/main.ts:78`](../../holita/apps/storefront/src/main.ts#L78)
