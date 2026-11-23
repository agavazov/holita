# 302 Preview, print and track Sales offers

**Status:** Ready after [138](138-holita-sales-offers.md). **Product:** Holita.

## Background

Ticket 138 saves priced Sales offer drafts. red.bg has an internal quote document, print
entry and lifecycle actions for preparation and manually sent offers.

## Goal

Let agents print their own offers and report the progress and expiry of manually sent quotes.

## Steps

1. Add an internal printable preview with both stored quote lines and their EUR-per-month
   before-VAT labels. Reuse author-scoped offer detail.
2. Mark a Draft Prepared with `preparedAt`, then allow Mark manually sent with
   `manuallySentAt`. Clearing manually sent status returns to Prepared. Editing a prepared
   quote returns it to Draft. Require clearing manually sent status or making a new quote
   before editing a sent one.
3. Extend My Offers with URL-backed `status=draft|prepared|manuallySent` and
   `expires=within7Days`. The expiry filter selects manually sent offers from today through
   seven days ahead, inclusive, in Europe/Sofia. Share the predicate with 142.
4. Add one insert-only demo prepared offer and one manually sent linked offer with distinct
   validity dates and both priced lines.

## Done when

An agent can print both stored prices and advance and reverse the supported lifecycle.
The expiry URL shows only their sent quotes in the stated window.

## Limits

Internal browser print and manual lifecycle only. External delivery, public sharing and
provider PDF services remain excluded.

## References

- [red.bg printable offer](../../../red.bg/workspace-sales/services/sales/resources/views/sales/crm/offer-maker/templates/red-bg-online-store/v1/document.blade.php)
- [red.bg offer actions](../../../red.bg/workspace-sales/services/sales/app/Http/Controllers/Sales/Crm/OfferMakerController.php#L265)
- [Holita Sales route registration](../../holita/apps/sales/src/main.ts#L9)
