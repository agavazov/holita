# 139 Configure appointment services and availability

**Status:** Ready after [131](131-holita-sales-sales-service.md). **Product:** Holita.

## Background

red.bg defines booking services with a slot duration, a buffer and weekday availability.
Its editor applies one local-time window to the selected weekdays.

## Goal

Give Sales agents a Services screen that defines the schedule used by appointment booking.

## Steps

1. Keep service ID, platform tenant ID, name, description, active flag, calendar color
   chosen from the shared palette, duration minutes, buffer minutes, and created/updated
   timestamps. Store ISO weekdays and one start/end local-time window applied to those
   days in Europe/Sofia. Use a 45-minute duration, 15-minute buffer and weekdays
   09:00–17:00 as editor defaults.
2. Validate a nonblank name, at least one selected weekday, positive duration,
   nonnegative buffer, and a same-day window that fits both duration and buffer.
   Add tenant-scoped list, detail, create, edit and deactivate operations.
3. Add Sales Appointment Services list and shared create/edit drawers. Show active status,
   duration, buffer and schedule. Reactivation is the same active flag edit.
4. Seed one active Store demo service and one inactive legacy Consultation service with
   stable IDs and representative schedules.

## Done when

A Sales agent can create an active appointment service and edit its available weekdays and
hours. Invalid windows fail with field feedback and deactivated services remain in the list.

## Limits

Availability belongs to the service. No staff calendars, time-off, recurring appointments,
external calendar sync or public booking.

## References

- [red.bg appointment service model](/workspace/projects/red.bg/workspace-sales/services/sales/app/Models/Booking/BookingService.php)
- [red.bg weekly availability model](/workspace/projects/red.bg/workspace-sales/services/sales/app/Models/Booking/BookingAvailabilityRule.php)
- [red.bg service and schedule validation](/workspace/projects/red.bg/workspace-sales/services/sales/app/Services/Booking/ServiceManager.php)
- [red.bg shared window editor](/workspace/projects/red.bg/workspace-sales/services/sales/resources/views/sales/booking/services/partials/form.blade.php)
