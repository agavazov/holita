# 358 Reconcile the final red.bg Sales transfer

**Status:** Blocked pending the owner's final review, a current Sales export and the applicable CRM screens. **Product:** Holita.

## Background

The first local import uses the Sales snapshot promoted on 2026-08-21. The initial preview covers leads and contacts. The local staging copy also holds company records and their attributes, an offer, and service availability. A newer export may include new business records or edits.

## Goal

Account for every in-scope Sales record at cutover and preserve edits made in Holita after the first review.

## Steps

1. Obtain the approved final export and its timestamp and checksum. Compare its CRM inventory to the initial import manifest. Use aggregate counts in status reports. Keep source archives private.
2. Reconcile leads and contacts by their source IDs with the initial import. Map eligible stages and agent assignments against the implemented Sales models and verified Core identities. Match company information, offers and booking configuration to the implemented workflows. List fields and relationships requiring a product decision before writing them.
3. Produce counts for unchanged, new, edited, unmatched and excluded records per entity. Show conflicts for review through private local tooling. Apply approved changes additively and repeat reconciliation to verify identities and links. Never overwrite an operator edit without a decision.
4. Verify the approved real records through the authenticated local Sales UI. Record the final source version and reconciliation counts in the private handoff status.

## Done when

The owner can review the complete supported CRM data locally. Source and target totals reconcile, links resolve and every remaining difference has a recorded disposition.

## Limits

Exclude telephony, recordings, SMS, crawler payloads, external providers, passwords and old browser sessions. The final source and cutover time come from the owner. No production writes, database resets or publishing.

## References

- [Migration queue](holita-migration.md)
- [red.bg Sales inventory](../../holita/docs/red-bg/services/sales.md)
