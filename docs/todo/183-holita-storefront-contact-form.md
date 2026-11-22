# 183 Submit an inquiry from the contact page

**Status:** Ready after [126](126-holita-general-settings.md), [182](182-holita-admin-inquiry-inbox.md). **Product:** Holita.

## Background

red.bg Basic posts a contact form into the merchant inquiry inbox. Queue 126 renders public contact information.

## Goal

Let shoppers send a shop inquiry from the Basic contact page.

## Steps

1. Add a shop-scoped public submission over the inquiry record, with request validation and the existing public throttling approach.
2. Add a localized contact form with submission, success and failure states.

## Done when

A valid submission appears in the selected shop's inbox. Invalid input shows useful field feedback.

## Limits

Plain text only. No external form service or email marketing.

## References

- [red.bg public submission](../../../red.bg/workspace-ecommerce/services/storefront/basic/app/Http/Controllers/PublicSubmissionController.php)
- [General settings queue](../../docs/todo/126-holita-general-settings.md)
- [Storefront graph](../../holita/apps/commerce/src/storefront.graphql)
