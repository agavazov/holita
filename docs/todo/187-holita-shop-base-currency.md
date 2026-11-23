# 187 Decide the base currency policy for shops

**Status:** Needs owner. Which base currencies are allowed for new shops, from what effective date, and when does the shop's choice lock? **Product:** Holita.

## Background

red.bg stores a base currency in its settings API. The existing Holita general settings shipped in
`946cb21d`, and Commerce checkout currently uses BGN.

## Goal

Record the owner's decision once so the Branch setting, historical snapshots and currency display can
be implemented separately.

## Steps

1. Record the approved currency choices, the effective date and the event that locks the setting for
   a shop. Confirm how the current BGN default applies to existing shops and records.

## Done when

The decision specifies which currency is assigned to shops and new transactions at the cutover and
how a later merchant selection is constrained. Existing order and invoice currency snapshots retain
their recorded values.

## Limits

Policy only, with one base currency per shop. The follow-up tickets handle implementation.

## References

- [red.bg currency setting](../../../red.bg/workspace-ecommerce/services/api/app/Services/Settings/StoreSettingsService.php#L44)
- [red.bg currency service](../../../red.bg/workspace-ecommerce/services/api/app/Services/Commerce/StoreCurrencyService.php)
- [Holita checkout currency](../../holita/apps/commerce/src/checkout/currency.ts#L1)
- [Holita existing general settings](../../holita/apps/commerce/src/shop-settings/shop-settings.service.ts#L24)
