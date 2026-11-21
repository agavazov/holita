# 005 CB2792TK faulty eData

**Status:** Blocked: a new eData has to be fitted on site. **Product:** Discocan (on-site case).

## Background

CB2792TK is a DAF with a StarLink Tracker. On 2026-11-19:

- From 14:18 to 14:40 Sofia time, the tachograph data with a driver card came through with the good
  eData borrowed from CB8112XB, on the truck's unchanged wiring.
- The original eData went back in at 15:18. In about 1.5 hours of driving it sent no `405`, so the
  original eData is faulty.

Earlier changes on this truck, all with the owner's approval:

- tachograph definitions 1435–1439, 1441 and 1447 at 180 s were added;
- parameter `0774` was set to 0 (ticket 009).

Details and the IMEI are in `.references/onsite/NOTES.md`.

## Goal

CB2792TK has a working eData that sends engine and tachograph data and answers fault reads.

## Steps

Start when the owner or the on-site team reports the new eData is fitted.

1. With the engine on, check the journal (see ticket 004 for the codes): `411` with CAN, `405` with
   1435–1447, and the eData version reply `56`.
2. A new eData may not carry the old unit's definitions. Compare its definitions with the list in
   `NOTES.md`. Adding them is an eData write: ask the owner first. The write command is in
   `NOTES.md`.
3. Check a fault read. Either wait for Fleet's 30-minute job and look for the `154` reply, or use
   `.references/onsite/scripts/scan-on-ignition.py`, which waits for ignition and runs the reads.
4. If the eData model or serial changed, update the Device's eData module in the admin's Device
   form.

## Done when

`405` arrives with tachograph values and fault reads get a valid `154` reply.

## Limits

eData writes only with the owner's explicit yes.
