# 018 Track gaps per device type

**Status:** Blocked: needs the hardware's reporting cadence. **Product:** Discocan (Fleet).

## Background

`discocan/apps/fleet/src/modules/telemetry/vehicle-track.ts` finds gaps in a vehicle's track by
assuming ERM's cadence: a sample every 5 minutes while active and every hour at rest. A device with
another cadence would show false gaps or hide real ones.

## Goal

Gap thresholds follow the cadence of the device type that sent the samples.

## Steps

1. Take the hardware's cadence from its documentation or real data.
2. Pass the thresholds by Device type. Keep ERM's values unchanged.
3. Extend the existing track test only if the change involves raw SQL or a real defect.

## Done when

A hardware Device's track shows gaps only where reports are really missing.
