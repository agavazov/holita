# 303 Show the appointment calendar and booking editor

**Status:** Ready after [140](140-holita-sales-bookings.md). **Product:** Holita.

## Background

Ticket 140 provides the Sales appointment write contract and slot availability. red.bg
has a calendar, an appointment listing and booking from a lead.

## Goal

Give agents a calendar, detail and submission flow over the existing Sales booking contract.

## Steps

1. Add an Appointments calendar, list and detail. Use a shared service/date/slot editor for
   booking and rescheduling. Show linked appointments and a Book appointment action on Lead
   Detail. Display the recorded time, status and service.
2. Add URL-backed service, `status`, `scope=mine|team` and `period=today|next7Days`. Mine
   includes a booking once when the current agent created it or is assigned to its lead.
   Today is the current Sofia date. Next 7 days starts tomorrow and covers seven Sofia dates.
   Keep Mine + Confirmed + period combinable and share the predicates with 142.
3. Verify list membership at Monday 2026-11-23 09:00 Europe/Sofia using the dedicated guarded
   schema and a weekday service, 09:00–17:00, with 45-minute duration and a 15-minute buffer.
   Use a Monday 10:00 confirmed slot created by the demo agent, a Tuesday 11:00 confirmed slot
   created by another agent for a lead assigned to the demo agent, a Monday 12:00 other-only
   booking and a Monday 13:00 cancelled mine booking. Keep these fixed-date verification
   records out of persistent development seed data.

## Done when

A Sales agent can create or reschedule a booking in the editor and open it in the calendar
and on its lead. Mine + Confirmed returns only Monday 10:00 for Today and Tuesday 11:00 for
Next 7 days in the isolated fixture.

## Limits

Reuse the slot and status rules from 140. Use local Sales booking only.

## References

- [red.bg appointment calendar](../../../red.bg/workspace-sales/services/sales/resources/views/sales/booking/bookings/index.blade.php)
- [red.bg appointment editor](../../../red.bg/workspace-sales/services/sales/resources/views/sales/booking/bookings/partials/form.blade.php)
- [Holita Sales route registration](../../holita/apps/sales/src/main.ts#L9)
