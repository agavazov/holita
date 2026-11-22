# 178 Pin earned digital downloads to a private file version

**Status:** Blocked. Deferred pending API-only delivery scope and a stable file version contract in 177. **Product:** Holita. Depends on [177](177-holita-variant-digital-file.md).

## Background

red.bg issues grants when eligible orders complete and serves authenticated downloads through its API. The Basic routes have no account download screen.

## Goal

If delivery API parity is approved, serve the exact earned file to the verified shopper.

## Steps

1. Issue a grant once per eligible completed order line and pin it to the private immutable file version available when the grant is earned.
2. Authorize each download using the verified shopper, Tenant and Branch. Preserve already-earned versions across future variant edits, replacement and removal.

## Done when

An eligible owner can download the version they earned, even after a replacement. Another shopper or shop cannot fetch it.

## Limits

Deferred API scope only. Keep a new Basic download screen outside migration parity.

## References

- [red.bg digital grants](../../../red.bg/workspace-ecommerce/services/api/app/Services/Commerce/DigitalDeliveryService.php#L54)
- [red.bg download API](../../../red.bg/workspace-ecommerce/services/api/app/Http/Controllers/Api/Storefront/Customer/DownloadsController.php)
- [red.bg Basic routes](../../../red.bg/workspace-ecommerce/services/storefront/basic/routes/web.php)
