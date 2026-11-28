# 137 Schedule and complete lead tasks

**Status:** Ready after [135](135-holita-sales-agent-assignment.md), [136](136-holita-sales-notes.md). **Product:** Holita.

## Background

red.bg moves the next scheduled action into lead task records. Its work queue shows pending
and in-progress tasks and highlights active leads without follow-up. Completed and cancelled
tasks appear in Lead Detail activity.

## Goal

Let Sales agents schedule follow-up and record the outcome from Lead Detail.

## Steps

1. Keep task ID, platform tenant ID, lead ID, scheduled date/time, type, status, note and
   created/updated timestamps. Use Pending, In progress, Completed and Cancelled and the existing
   manual task types Outreach, Prepare demo site, Prepare/send offer, Demo and Research. Default
   to Pending and derive the agent from the current lead assignment.
2. Add task add/edit and status actions on Lead Detail. Show the next pending or in-progress task
   by schedule in Leads and include completed and cancelled work in Activity. Use cancellation for
   mistaken entries so the lead retains its follow-up history.
3. Seed stable insert-only open and completed tasks against existing demo leads.

## Done when

An agent can schedule, reschedule, complete or cancel a task from Lead Detail. The next scheduled
task updates in Leads and completed or cancelled work appears in the lead timeline.

## Limits

The separate work queue follows in 301. Keep tasks manually managed. No reminders, background worker, communications actions, automatic
completion suggestions or automatic demo shop creation.

## References

- [red.bg task model](../../../red.bg/workspace-sales/services/sales/app/Models/Crm/LeadTask.php)
- [red.bg task types](../../../red.bg/workspace-sales/services/sales/app/Enums/Sales/Crm/CrmLeadTaskType.php)
- [red.bg task editor](../../../red.bg/workspace-sales/services/sales/resources/views/sales/crm/leads/partials/task-editor.blade.php)
- [red.bg task dashboard](../../../red.bg/workspace-sales/services/sales/app/Services/Dashboard/LeadTaskDashboard.php)
- [Holita Sales shell hosting CRM routes](../../holita/apps/sales/src/main.ts#L9)
