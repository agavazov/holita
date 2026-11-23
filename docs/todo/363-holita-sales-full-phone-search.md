# 363 Make full phone searches independent of formatting

**Status:** Ready. **Product:** Holita.

## Background

Independent review HLR-05 identified this behavior at `1b44cc90`. The full-number search and independent fragment checks can include other contacts when a full number is written with spaces. A synthetic execution of the search helpers matched two candidates for a formatted query and one for its compact equivalent.

## Goal

Make full phone searches independent of formatting.

## Steps

Normalize full phone queries consistently in Contacts and Leads, preserving intentional fragment and mixed-text searches.

## Done when

Equivalent formatted and compact full numbers match the same lead and contact set, including when nearby numbers share fragments.

## Limits

Sales searches on synthetic records with non-identifying fixture data.

## References

- [contact-search.ts](../../holita/apps/sales-api/src/contacts/contact-search.ts#L4)
- [contact-phone.ts](../../holita/apps/sales-api/src/contacts/contact-phone.ts#L17)
- [contacts.repository.ts](../../holita/apps/sales-api/src/contacts/contacts.repository.ts#L34)
- [leads.repository.ts](../../holita/apps/sales-api/src/leads/leads.repository.ts#L23)
