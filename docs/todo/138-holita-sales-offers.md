# 138 Prepare and track priced offers

**Status:** Ready after [133](133-holita-sales-contacts.md). **Product:** Holita.

## Background

red.bg's Offer Maker supports standalone or lead-linked offers. Its template editor stores a
recommended and an alternative plan with editable monthly euro prices. The reference document
labels the recommended monthly price before VAT; the alternative is stored and editable in
the source form.

## Goal

Let agents prepare, preview, print and manually track offers with the two plan/price lines.

## Steps

1. Keep offer ID, platform tenant ID, optional lead ID, author Core user ID, recipient
   name and email, reply email and phone, current and proposed site URL, optional example
   domain, validity date, product/category counts, languages, current platform, personal
   message and created/updated timestamps. Accept manually entered context and prefill
   from the lead and primary contact when available.
2. Keep two typed optional quote lines, Recommended and Alternative, each with plan name
   and nonnegative decimal monthly price. Require name and price together for each line.
   Show included scope as editable text, and label prices EUR per month before VAT. Use
   the source Start 19.99 and Growth 35.00 as demo examples.
3. Add My Offers list, offer create/edit/detail, a printable internal preview and a linked
   offers section on Lead Detail for the author. Keep author-scoped access within the
   platform tenant. Expose URL-backed search, `status=draft|prepared|manuallySent` and
   `expires=within7Days`. The latter selects manually sent offers with a validity date
   from today through seven days ahead, inclusive, in Europe/Sofia. Use the same predicate
   in the dashboard count and offer list.
4. Start saves in Draft. Add a Mark prepared action on Offer Detail and preview that sets
   `preparedAt`. Allow Mark manually sent from Prepared; set `manuallySentAt` when the
   agent confirms that they sent the quote. Clearing manual sent status clears only
   `manuallySentAt` and returns to Prepared. Editing prepared quote content clears
   `preparedAt` and returns to Draft. To edit a sent quote, clear sent status first or
   create a new quote.
5. Seed one draft, one prepared offer and one manually sent linked offer with distinct
   validity dates and both priced lines. Use stable IDs and keep the seeds insert-only.

## Done when

An agent can draft a standalone or lead-linked offer, preview and print both exact prices,
then use Draft → Prepared → Manually sent. Clearing sent status returns it to Prepared.
The expiry URL shows only the agent's sent quotes in the stated window, and another agent's
offer cannot be opened by ID.

## Limits

No subscription activation, billing, catalogue snapshots, collection lookup, external sending,
public share URLs or tracking pixels. Offer pricing belongs to the quote.

## References

- [red.bg Offer model](/workspace/projects/red.bg/workspace-sales/services/sales/app/Models/Crm/Offer.php)
- [red.bg input fields](/workspace/projects/red.bg/workspace-sales/services/sales/app/Services/Crm/OfferInput.php)
- [red.bg plan defaults and validation](/workspace/projects/red.bg/workspace-sales/services/sales/app/Services/Crm/OfferTemplates/RedBgOnlineStoreV1.php)
- [red.bg two plan price fields](/workspace/projects/red.bg/workspace-sales/services/sales/resources/views/sales/crm/offer-maker/templates/red-bg-online-store/v1/form.blade.php)
- [red.bg printable offer and VAT label](/workspace/projects/red.bg/workspace-sales/services/sales/resources/views/sales/crm/offer-maker/templates/red-bg-online-store/v1/document.blade.php)
- [red.bg offer preview, print and manual sent actions](/workspace/projects/red.bg/workspace-sales/services/sales/app/Http/Controllers/Sales/Crm/OfferMakerController.php)
