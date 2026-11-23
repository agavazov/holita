# 145 Manage prospect online stores

**Status:** Ready after [300](300-holita-sales-workspace-access.md). **Product:** Holita.

## Background

red.bg has a standalone Online Stores list and manual editor. A record describes an existing
prospect website and its known identifiers, independently of a lead and of any Core shop.

## Goal

Let agents record, find and maintain prospect stores in a standalone Sales screen.

## Steps

1. Keep store ID, platform tenant ID, display URL, normalized URL and hostname, and
   created/updated timestamps. Accept website addresses with or without HTTP(S) scheme.
   Use a canonical URL for duplicate detection and search, coalescing a default scheme,
   leading www and equivalent root URLs, with host case normalized and fragments dropped.
   Preserve meaningful paths and query parameters. Reject invalid URLs, credentials in a
   URL and unsupported schemes. Enforce uniqueness of normalized URL per Sales tenant.
2. Keep zero or more identifiers per store with ID, tenant ID, store ID, kind, entered value
   and normalized value, plus timestamps. Support company EIK, email and phone. Normalize
   case and whitespace for EIK and email and normalize Bulgarian phone formatting to its
   canonical form. Reject invalid email/phone and duplicate normalized values of the same
   kind within one store. Apply store and identifier edits together.
3. Add tenant-scoped Online Stores navigation, paginated list, detail and shared create/edit
   drawers. Search by normalized URL or hostname, EIK, email and phone, applying equivalent
   normalization to search input. Keep the query in the URL and expose field feedback for
   duplicate URLs.
4. Seed two fictional prospect domains with stable store and identifier IDs. Include an EIK,
   a company email and a Bulgarian-format phone so the normalized searches can be exercised.

## Done when

An agent can add and edit a standalone store and retrieve it using equivalent URL and
identifier formats. Duplicate URLs are caught in the same tenant, and none of its
identifiers can be read or changed across tenants.

## Limits

Manual data entry only. No fetching websites, crawler, discovery, enrichment, catalogue
acquisition, Core shop provisioning, lead linking or external integrations.

## References

- [red.bg online-store schema](../../../red.bg/workspace-sales/services/sales/database/migrations/2026_09_02_000003_replace_crm_websites_with_online_stores.php)
- [red.bg online-store model](../../../red.bg/workspace-sales/services/sales/app/Models/Crm/OnlineStore.php)
- [red.bg online-store search](../../../red.bg/workspace-sales/services/sales/app/Services/Crm/OnlineStoreListingQuery.php)
- [red.bg URL normalization](../../../red.bg/workspace-sales/services/sales/app/Services/Crm/OnlineStoreUrlNormalizer.php)
- [red.bg identifier normalization](../../../red.bg/workspace-sales/services/sales/app/Services/Crm/OnlineStoreIdentifierNormalizer.php)
- [red.bg Online Stores list](../../../red.bg/workspace-sales/services/sales/resources/views/sales/crm/online-stores/index.blade.php)
- [red.bg store editor](../../../red.bg/workspace-sales/services/sales/resources/views/sales/crm/online-stores/partials/form.blade.php)
- [Holita Sales routes](../../holita/apps/sales/src/main.ts#L9)
