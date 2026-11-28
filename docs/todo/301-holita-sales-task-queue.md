# 301 Show the Sales follow-up task queue

**Status:** Ready. **Product:** Holita.

## Background

Sales records [follow-up tasks](../development.md#holita) on each lead. red.bg exposes an agent
and team work queue and identifies active leads with no open task.

## Goal

Give Sales a task queue and reusable date and follow-up predicates for Quick Work and reporting.

## Steps

1. Add a Sales Tasks screen, defaulting to Mine, with URL-backed `scope=mine|team` and
   `bucket=overdue|today|upcoming|noFollowUp`. With no bucket, show a grouped queue. Use the
   lead's current assignment and link rows to Lead Detail.
2. Bucket Pending and In progress tasks on active leads by scheduled Europe/Sofia date. Overdue
   precedes today, Today is the current Sofia date and Upcoming starts at the next Sofia
   midnight. No follow-up contains active leads with zero Pending or In progress tasks, once
   per lead. Share these predicates with dashboard counts. Quick Work has a separate prompt
   for active leads with only overdue tasks.
3. Add stable demo tasks for the three date buckets and an active assigned lead without any
   open work. Reuse existing demo agents and tasks.

## Done when

The Tasks URL restores the requested scope and bucket, reassignment moves open tasks to the new
agent's queue, and an active lead with no open tasks appears once under No follow-up.

## Limits

Read-side queue and predicates only. Keep completed and cancelled work in Lead Detail.

## References

- [red.bg queue and date predicates](../../../red.bg/workspace-sales/services/sales/app/Services/Dashboard/LeadTaskDashboard.php)
- [red.bg task listing handler](../../../red.bg/workspace-sales/services/sales/app/Http/Controllers/Sales/Crm/LeadsController.php#L80)
- [Holita Sales navigation registration](../../holita/apps/sales/src/main.ts#L9)
