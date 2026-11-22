# 137 Schedule and complete lead tasks

**Status:** Ready after [134](134-holita-sales-pipeline.md), [135](135-holita-sales-agent-assignment.md), [136](136-holita-sales-notes.md). **Product:** Holita.

## Background

red.bg moves the next scheduled action into lead task records. Its work queue shows pending
and in-progress tasks and highlights active leads without follow-up. Completed and cancelled
tasks appear in Lead Detail activity.

## Goal

Let sales agents schedule follow-up, work their queue and keep the outcome on each lead.

## Steps

1. Keep task ID, platform tenant ID, lead ID, scheduled date/time, type, status, note and
   created/updated timestamps. Use Pending, In progress, Completed and Cancelled. Keep
   manual Outreach (the legacy Call type), Prepare demo site, Prepare/send offer, Demo and
   Research. Default to Pending, and derive the agent from the current lead assignment.
2. Add task add/edit and status actions on Lead Detail, show the next pending/in-progress
   task by schedule in Leads, and put completed/cancelled tasks into Activity.
3. Add a Sales Tasks screen with URL-backed `scope=mine|team` (Mine by default) and
   `bucket=overdue|today|upcoming|noFollowUp`. With no bucket, show the grouped queue.
   For Pending/In progress tasks on active leads, Overdue is before the current Sofia
   date, Today is that local date, and Upcoming starts at the next local midnight.
   No follow-up contains active leads with zero Pending/In progress tasks, counted once
   per lead. Closed leads retain task history on their detail. Share these predicates
   with dashboard counts. The Quick Work prompt for overdue-only leads lands in 146.
4. Seed overdue, today, upcoming and completed tasks against existing demo leads and leave
   one assigned lead without a task. Use stable IDs and dates relative to the first seed.

## Done when

An agent can schedule, reschedule, complete or cancel a task and see the next task update.
Reassigning a lead moves its open tasks to the new owner's queue. A completed task moves to
the timeline and an active lead with no open tasks appears under No follow-up. A direct
URL restores the requested scope and bucket and lists exactly those tasks or leads.

## Limits

Keep tasks manually managed. No reminders, background worker, communications actions, automatic
completion suggestions or automatic demo shop creation.

## References

- [red.bg task model](/workspace/projects/red.bg/workspace-sales/services/sales/app/Models/Crm/LeadTask.php)
- [red.bg task types](/workspace/projects/red.bg/workspace-sales/services/sales/app/Enums/Sales/Crm/CrmLeadTaskType.php)
- [red.bg task editor](/workspace/projects/red.bg/workspace-sales/services/sales/resources/views/sales/crm/leads/partials/task-editor.blade.php)
- [red.bg task dashboard](/workspace/projects/red.bg/workspace-sales/services/sales/app/Services/Dashboard/LeadTaskDashboard.php)
