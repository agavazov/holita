# 146 Save lead follow-up in Quick Work

**Status:** Ready after [301](301-holita-sales-task-queue.md). **Product:** Holita.

## Background

red.bg opens Quick Work directly from the Leads list. Its task summary prompts agents
to schedule follow-up when an active lead has no pending or in-progress task today or later,
including leads with only overdue work.

## Goal

Let an agent complete a task, update the stage, write a note and schedule the next action
from the Leads list in one save.

## Steps

1. Add a Quick Work row action and follow-up prompt to Leads. Use the Sofia
   day buckets from 301. Prompt for an active lead with no open work scheduled today or
   later, including an active lead whose only open tasks are overdue. Closed leads do
   not show the prompt.
2. Open a shared drawer with the lead's current stage and selectable open tasks. The
   editable fields are task to complete, new stage, optional note text and occurrence
   time, and next task type, scheduled time and optional note. Allow saving any subset.
   Prefill the next-action editor when opened from the prompt.
3. Add one tenant-scoped mutation that validates and writes the requested changes in a
   single Sales transaction. Confirm that the task belongs to the lead, reuse the lead
   stage, note and task rules, and retain the verified Core user for note authorship.
   Return the updated lead summary and refresh the retained list. Validation failure
   keeps all records as they were.
4. Seed an active lead with only an overdue task and a closed lead with no future task.
   Reuse the existing agent and task types and keep fixture IDs stable.

## Done when

A single save can complete the selected task, change the stage, append the note and
schedule the next action. The updated Leads row clears the prompt after later work is
scheduled or the lead closes. A rejected field leaves all four changes unapplied.

## Limits

Manual follow-up only. No communications, automatic task completions, external providers
or new activity entities.

## References

- [red.bg Quick Work routes and handler](../../../red.bg/workspace-sales/services/sales/app/Http/Controllers/Sales/Crm/LeadsController.php)
- [red.bg task summary and prompt rules](../../../red.bg/workspace-sales/services/sales/app/Services/Crm/LeadTaskListingPresenter.php)
- [red.bg Quick Work editor](../../../red.bg/workspace-sales/services/sales/resources/views/sales/crm/leads/partials/quick-work-fields.blade.php)
- [red.bg Leads list follow-up prompt](../../../red.bg/workspace-sales/services/sales/resources/views/sales/crm/leads/partials/task-listing-summary.blade.php)
- [Holita Sales route registration](../../holita/apps/sales/src/main.ts#L9)
