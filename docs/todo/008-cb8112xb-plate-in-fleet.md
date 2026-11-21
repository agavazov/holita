# 008 CB8112XB plate in Fleet

**Status:** Needs owner: the manager has to confirm the plate change. **Product:** Discocan (Fleet).

## Background

The truck that is CB8112XB on site is registered in Fleet as CB5636XP, with the same VIN. Its ERM
Device is attached to that vehicle. The change waits for the manager's confirmation, which the owner
passes on.

## Goal

Fleet shows the truck as CB8112XB and keeps its history.

## Steps

1. Ask the owner whether the manager has confirmed that CB8112XB is the same truck (same VIN).
2. If yes, change the plate of the existing vehicle in the admin. Do not create a second vehicle:
   trips, odometer, maintenance and Device history stay on the existing record.
3. Check whether anything keys on the plate (notification texts, Karma car mapping on the Device,
   reports) and whether it needs a follow-up.
4. Check the vehicle list, the Devices list and the live dashboard for CB8112XB.

## Done when

All screens show CB8112XB with the old history.

## Limits

If the VIN turns out to be different, stop and ask the owner; it is then a different vehicle.
