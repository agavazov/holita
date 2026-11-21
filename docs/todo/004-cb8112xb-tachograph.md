# 004 CB8112XB tachograph on the standard wiring

**Status:** Ready (read-only); depends on the on-site team. **Product:** Discocan (on-site case).

## Background

CB8112XB (Fleet still lists it as CB5636XP, see ticket 008) has a StarLink Scout with a working
Simple eData.

- On 2026-11-19 the eData wired directly to the tachograph reported only `417` (no CAN), so that
  wiring is wrong.
- On the standard wiring it gave engine data and driver states, but the driver card value stayed 0.
- The manager said the installer would put it back on the standard wiring on 2026-11-20. The result
  is unknown.

The case notes, the unit's IMEI and the scripts are in `.references/onsite/NOTES.md` (Git-ignored,
temporary).

## Goal

Know whether the truck sends tachograph data with a driver card. Tell the owner what the on-site
team should do next.

## Steps

1. Read the relay journal `.references/erm-relay/YYYY-MM-DD.jsonl` from 2026-11-20 for the truck's
   unit. Times are UTC; Sofia is UTC+2. What to look for:
   - `411`: the first byte's bit 0 means CAN is present;
   - `417`: no CAN;
   - `405`: values, including the tachograph parameters 1435–1447 (1439 is the driver 1 card and
     1436 the driver 1 state).
2. If the truck has not driven since, run the read-only listener in the background:
   `cd .references/onsite/scripts && python3 -I listen.py --since <UTC now> --reported moving:CB8112XB`.
   It exits when something needs attention and prints the arguments to resume.
3. Summarise for the owner, in Sofia time: CAN yes or no, tachograph states, driver card yes or no.
4. If the card still does not show, draft a short Bulgarian message for the manager. Say what to
   check next, for example that the eData listens on the tachograph's CAN (C) or the FMS connector
   rather than the engine CAN.

## Done when

The owner has a clear verdict and, if needed, the message for the manager. Add the verdict to
`NOTES.md`.

## Limits

Read-only. Any device write (eData definitions, parameters) needs the owner's explicit yes.
