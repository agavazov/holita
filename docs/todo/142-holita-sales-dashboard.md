# 142 Show the daily sales dashboard

**Status:** Ready after [302](302-holita-sales-offer-preview-lifecycle.md), [303](303-holita-sales-appointment-calendar.md), [304](304-holita-sales-handoff-new-shop.md). **Product:** Holita.

## Background

red.bg combines seller-specific lead, task, offer and appointment panels for daily work.
Holita's handoff flows record who initiated each won-lead conversion and when it completed.

## Goal

Show the signed-in agent their work, pipeline and completed handoffs, with drill-down links
that open the same records counted on the dashboard.

## Steps

1. Add a Sales dashboard query scoped by verified platform tenant and Core user. Return
   counts and small ordered previews for My leads by stage, overdue/today/upcoming open
   tasks and active leads without open tasks, authored Draft/Prepared/Manually sent and
   sent offers expiring within seven days, My confirmed appointments for Today and Next
   7 days, and handoffs I initiated that completed in the last 30 Sofia dates including today.
   Use the same feature query predicates for counts and corresponding lists.
2. Reuse the URL-backed handoff state, initiator and completed-date filters from 144. Combine Complete, initiated by Mine and
   the 30-day date range for the handoff count link. Count each completed handoff once
   across new-merchant and existing-merchant modes. Keep the current assignee filter
   independent of who initiated the handoff.
3. Make Dashboard the Sales landing page using shared KPI cards and lists with BG/EN
   labels and loading, error and zero states. Link lead stages to Leads with Mine and
   that stage, task counts to **Tasks** with **Mine** and the corresponding bucket, offer counts
   to the lifecycle or expiry URL from 302, and appointment counts to the Mine + Confirmed +
   period URL from 303. Link previews to their records.
4. Reuse insert-only demo records for ordinary exploration. Verify date counts in a
   separate guarded schema with the server and browser fixed at Monday 2026-11-23 at
   09:00 Europe/Sofia. Use 303's active weekday service (09:00–17:00, 45-minute slots
   with 15-minute buffer) and dated booking fixture. Expect My confirmed Today = 1
   (Monday 10:00) and Next 7 days = 1 (Tuesday 11:00); neither the other-only nor the
   cancelled appointment appears. Seed isolated supporting rows for the chosen agent:
   one assigned lead each in New, Interested, Try later and Won, one open task per
   date bucket on New/Interested, zero open tasks on Try later, one offer per lifecycle
   state with the sent offer valid through 2026-11-28, and one handoff for Won completed
   within the date range. Expect each listed stage, task bucket, No follow-up, offer
   status, expiry and completed handoff count to be 1. Include other-agent control rows
   and keep the fixed-date rows out of persistent seeds.

## Done when

Each count link opens a list whose total and record membership match its dashboard count
at the fixed reference time. In particular the appointment links show the two named slots
in their respective periods. Closing a task, marking an offer sent or booking an appointment
updates its count. Agents without work see zero states, and work belonging solely to the
other agent stays out of personal counts.

## Limits

Use live Sales records. No warehouse, layout customization, telephony, SMS, crawler metrics,
provider delivery status or visit analytics.

## References

- [Task queue filters](../development.md#holita)
- [Offer lifecycle and expiry filters](302-holita-sales-offer-preview-lifecycle.md)
- [Appointment filters and fixture](303-holita-sales-appointment-calendar.md)
- [Existing-merchant handoff](144-holita-sales-existing-merchant-handoff.md)
- [red.bg seller scoping](../../../red.bg/workspace-sales/services/sales/app/Services/Dashboard/SellerActivityScope.php)
- [red.bg task dashboard](../../../red.bg/workspace-sales/services/sales/app/Services/Dashboard/LeadTaskDashboard.php)
- [red.bg offers dashboard](../../../red.bg/workspace-sales/services/sales/app/Services/Dashboard/OfferDashboard.php)
- [red.bg booking dashboard](../../../red.bg/workspace-sales/services/sales/app/Services/Dashboard/BookingDashboard.php)
- [red.bg dashboard screen](../../../red.bg/workspace-sales/services/sales/resources/views/sales/dashboard/index.blade.php)
- [Holita current Sales landing screen](../../holita/apps/sales/src/main.ts#L9)
