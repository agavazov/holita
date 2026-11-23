# 133 Manage lead contacts

**Status:** Ready. **Product:** Holita.

## Background

red.bg keeps named contacts on a lead. A primary contact appears first and provides the
preferred way to reach a prospect.

## Goal

Let agents maintain the people and contact details for each lead.

## Steps

1. Keep contact ID, platform tenant ID, lead ID, name, phone, email, role, primary flag,
   notes and created/updated timestamps. Keep Owner, Manager, Employee, Technical and Unknown
   roles. Require at least one of name, phone or email, validate email and normalize phone
   for display/search. Allow a company inbox or phone as a contact when no person is known.
2. Enforce same-tenant lead ownership for contact reads and mutations. Update the primary flag
   within one transaction so promoting a contact clears the previous primary on that lead.
   Add contact name, email and phone to Leads search within the same tenant.
3. Add a Contacts section on Lead Detail with primary-first order and shared create/edit
   drawers and confirmed remove. List role, phone and email so agents can find the right person.
4. Seed one primary owner and one secondary technical contact for the first demo prospect and
   a shared company inbox for the second. Use fictional data and stable insert-only IDs.

## Done when

An agent can find a lead by a contact's details, edit multiple contacts and replace the primary.
Removing a contact leaves the prospect and its other contacts intact.

## Limits

Keep contacts within their lead. Source-managed contact extraction, CRM-wide deduplication and
communications integration are outside this ticket.

## References

- [red.bg Contact model](../../../red.bg/workspace-sales/services/sales/app/Models/Crm/Contact.php)
- [red.bg Contacts controller](../../../red.bg/workspace-sales/services/sales/app/Http/Controllers/Sales/Crm/ContactsController.php)
- [red.bg contact write and primary handling](../../../red.bg/workspace-sales/services/sales/app/Services/Crm/SalesCrmService.php)
- [red.bg lead contacts overview](../../../red.bg/workspace-sales/services/sales/resources/views/sales/crm/leads/partials/contacts-overview.blade.php)
- [Holita existing Sales app entry](../../holita/apps/sales/src/main.ts#L9)
