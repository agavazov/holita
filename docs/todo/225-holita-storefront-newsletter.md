# 225 Collect newsletter opt-ins in Basic

**Status:** Ready after [224](224-holita-admin-newsletter-subscribers.md). **Product:** Holita.

## Background

red.bg Basic accepts newsletter submissions and stores them for Admin. Holita has no storefront subscription form.

## Goal

Let a shopper opt in to the selected shop's newsletter.

## Steps

1. Add a public, scoped and repeatable signup endpoint over the local subscription register.
2. Add a fixed Basic storefront entry point, localized consent and result feedback.

## Done when

Submitting an email records one opt-in in that shop's Admin list and works for guests.

## Limits

Local subscription only. No marketing connector or outbound campaigns.

## References

- [red.bg public submission](../../../red.bg/workspace-ecommerce/services/storefront/basic/app/Http/Controllers/PublicSubmissionController.php)
- [Basic routes](../../../red.bg/workspace-ecommerce/services/storefront/basic/routes/web.php)
- [Holita storefront shell](../../holita/apps/storefront/src/main.ts)
