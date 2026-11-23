# 136 Record lead notes and activity

**Status:** Ready after [135](135-holita-sales-agent-assignment.md). **Product:** Holita.

## Background

red.bg stores multiple dated lead notes and shows them on Lead Detail in the activity feed.
Its later note migration retains the time as well as the date.

## Goal

Give agents a chronological record of prospect conversations and internal notes.

## Steps

1. Add a note with ID, platform tenant ID, lead ID, occurrence date and time, text, author
   Core user ID, and created/updated timestamps. Write within the lead's tenant scope. Require
   nonblank text and an occurrence time, defaulting to now in the editor. Store instants and
   display local sales time in Europe/Sofia.
2. Add an Activity section to Lead Detail, newest first, and use shared editors for adding,
   editing and removing notes. Display the occurrence time, plain note text and author
   display name from the Core lookup. Ticket 137 adds completed tasks to this section.
3. Insert two notes for a seeded prospect with stable IDs and distinct occurrence times, one
   backdated and entered after the other.

## Done when

Agents can add a note while working a lead and correct its text or occurrence time. Refreshing
the detail preserves the proper order. Notes stay with their lead and tenant.

## Limits

Manual entries only. No call records, transcripts, messages, attachments or separate activity
event store.

## References

- [red.bg note model](../../../red.bg/workspace-sales/services/sales/app/Models/Crm/LeadNote.php)
- [red.bg note timestamp migration](../../../red.bg/workspace-sales/services/sales/database/migrations/2026_08_26_000005_add_time_to_crm_lead_notes.php)
- [red.bg note editor](../../../red.bg/workspace-sales/services/sales/resources/views/sales/crm/leads/partials/note-editor.blade.php)
- [red.bg activity panel](../../../red.bg/workspace-sales/services/sales/resources/views/sales/crm/leads/partials/activity.blade.php)
- [Holita existing Sales app entry](../../holita/apps/sales/src/main.ts#L9)
