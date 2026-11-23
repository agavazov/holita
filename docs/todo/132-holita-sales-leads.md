# 132 Manage prospect records

**Status:** Ready after [300](300-holita-sales-workspace-access.md). **Product:** Holita.

## Background

red.bg lets agents enter and edit prospects manually and find them again by company, website
or source. Prospects can exist before they have a contact, a merchant account or a shop.

## Goal

Give agents a shared Leads list and a usable prospect detail screen.

## Steps

1. Add the Sales-owned Lead with `id`, platform `tenantId`, display name, optional website URL,
   optional source name, creator Core user ID, and created/updated timestamps. Require a display
   name or an HTTP(S) website. Treat source as an agent-entered label.
2. Add tenant-scoped list, detail, create and update operations. Use the existing paged list
   contract with search across name, website and source, and use stable sorting.
3. Add Sales navigation to Leads, with a filterable list, detail, and routed create/edit drawers.
   Use the shared operator list, drawer and feedback patterns, typed Reactive Forms, generated
   operations and BG/EN labels. Link to the lead by its ID after saving.
4. Seed two fictional Bulgarian prospects under the platform tenant using stable IDs, one
   website-first and one named referral. Reuse the existing Core Sales account as creator
   through the lookup used by the Holita seed; reruns insert only.

## Done when

An agent can create either kind of lead, search for it, open it by URL and edit it.
A lead ID from another tenant cannot be used to read or update a record.

## Limits

Manual prospects only. Later tickets add contacts, pipeline, assignment and history. Omit global
hard delete, crawler metadata and discovered-store ingestion.

## References

- [red.bg Lead model](../../../red.bg/workspace-sales/services/sales/app/Models/Crm/Lead.php)
- [red.bg Leads controller](../../../red.bg/workspace-sales/services/sales/app/Http/Controllers/Sales/Crm/LeadsController.php)
- [red.bg Leads list](../../../red.bg/workspace-sales/services/sales/resources/views/sales/crm/leads/index.blade.php)
- [red.bg Lead detail](../../../red.bg/workspace-sales/services/sales/resources/views/sales/crm/leads/view.blade.php)
- [Holita Sales routes](../../holita/apps/sales/src/main.ts#L9)
