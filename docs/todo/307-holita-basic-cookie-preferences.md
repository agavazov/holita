# 307 Offer local Basic cookie preferences

**Status:** Needs owner. Does Basic currently need any optional cookie categories, and which choices and policy version should it show? **Product:** Holita.

**Depends on** [285](285-holita-shop-system-policy-pages.md).

## Background

The red.bg coverage report marks ST10 as P2. Basic currently has no optional-cookie preference flow. The source provides choices and a footer entry to revisit them.

## Goal

Offer local Basic cookie preferences.

## Steps

1. Confirm the optional categories in use and the policy link and version.
2. Implement a shop-keyed, versioned local choice with accept, reject and reopen actions. Apply it to any approved optional behavior.

## Done when

A visitor can reject optional categories and revisit the choice from the shop footer without affecting other shops.

## Limits

Use browser-local preferences. The server audit is separate. Exclude external marketing tags.

## References

- [red.bg `cookie-consent.blade.php`](../../../red.bg/workspace-ecommerce/services/storefront/basic/resources/views/layouts/partials/cookie-consent.blade.php)
- [red.bg `VisitorConsent.php`](../../../red.bg/workspace-ecommerce/services/storefront/basic/app/Services/Storefront/VisitorConsent.php)
- [Holita `apps/storefront/src/main.ts:78`](../../holita/apps/storefront/src/main.ts#L78)
- [Holita `apps/storefront/src/index.html:3`](../../holita/apps/storefront/src/index.html#L3)
