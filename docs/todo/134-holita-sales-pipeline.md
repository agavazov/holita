# 134 Track leads through pipeline stages

**Status:** Ready. **Product:** Holita.

## Background

red.bg uses a fixed lead status list. Not interested, Customer and Lost close a lead; Try later
keeps it active. The two early outreach statuses name calling in the source.

## Goal

Let agents qualify, defer, win and close prospects from the Leads workspace.

## Steps

1. Add a fixed stage, stage-changed timestamp and nullable won timestamp to Lead. Default
   existing and new leads to New. Keep New, Ready for outreach (approvedForCall), Outreach
   started (called), Interested, Try later, Not interested, Won (customer) and Lost. Treat
   Not interested, Won and Lost as closed. Set won time on entry into Won and clear it when
   reopened before conversion. Expose one explicit stage mutation and reuse stage semantics
   for subsequent queues.
2. Add a stage column and URL-backed stage and open/closed filters to Leads, and a stage
   badge and stage editor to Lead Detail. The Won stage records the outcome; ticket 141
   adds the handoff after winning.
3. Insert demo leads in Interested, Try later, Lost and Won, using new stable IDs and
   timestamps; preserve existing lead fixtures and make the Won fixture eligible for conversion.

## Done when

The default open view keeps Try later and hides closed leads. Closed records are still
searchable with the appropriate filter. Moving through stages and reopening an unconverted lead
updates both the detail and retained list.

## Limits

Use the list and detail workflow from red.bg. No configurable stage editor, drag-and-drop board,
telephony side effects or automatic merchant creation.

## References

- [red.bg lead statuses and close flags](../../../red.bg/workspace-sales/services/sales/app/Enums/Sales/Crm/CrmLeadStatus.php)
- [red.bg status migration](../../../red.bg/workspace-sales/services/sales/database/migrations/2026_08_26_000007_replace_follow_up_lead_status.php)
- [red.bg lead status editor](../../../red.bg/workspace-sales/services/sales/resources/views/sales/crm/leads/partials/lead-status-editor.blade.php)
- [red.bg lead list filters](../../../red.bg/workspace-sales/services/sales/resources/views/sales/crm/leads/partials/filters.blade.php)
- [Holita existing Sales app entry](../../holita/apps/sales/src/main.ts#L9)
