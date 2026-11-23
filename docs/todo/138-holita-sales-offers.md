# 138 Prepare and track priced offers

**Status:** Ready after [133](133-holita-sales-contacts.md). **Product:** Holita.

## Background

red.bg's Offer Maker supports standalone or lead-linked offers. Its template editor stores a
recommended and an alternative plan with editable monthly euro prices. The reference document
labels the recommended monthly price before VAT; the alternative is stored and editable in
the source form.

## Goal

Let agents save standalone and lead-linked draft offers with two validated quote lines.

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
3. Add an author-scoped My Offers list and draft create/edit/detail in the verified platform
   Tenant, with search and a linked offers section on Lead Detail. Save new offers in Draft.
   Seed one insert-only draft using both priced lines and a stable identifier.

## Done when

An agent can save and edit a standalone or lead-linked draft with both exact monthly amounts.
Another agent's offer cannot be opened by ID.

## Limits

Print and lifecycle follow in 302. Scope here excludes subscription activation, billing, catalogue snapshots, collection lookup, external sending,
public share URLs or tracking pixels. Offer pricing belongs to the quote.

## References

- [red.bg Offer model](../../../red.bg/workspace-sales/services/sales/app/Models/Crm/Offer.php)
- [red.bg input fields](../../../red.bg/workspace-sales/services/sales/app/Services/Crm/OfferInput.php)
- [red.bg plan defaults and validation](../../../red.bg/workspace-sales/services/sales/app/Services/Crm/OfferTemplates/RedBgOnlineStoreV1.php)
- [red.bg two plan price fields](../../../red.bg/workspace-sales/services/sales/resources/views/sales/crm/offer-maker/templates/red-bg-online-store/v1/form.blade.php)
- [red.bg printable offer and VAT label](../../../red.bg/workspace-sales/services/sales/resources/views/sales/crm/offer-maker/templates/red-bg-online-store/v1/document.blade.php)
- [red.bg offer preview, print and manual sent actions](../../../red.bg/workspace-sales/services/sales/app/Http/Controllers/Sales/Crm/OfferMakerController.php)
- [Holita Sales entry point](../../holita/apps/sales/src/main.ts#L9)
