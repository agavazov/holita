# 006 CB9405PE eData without CAN

**Status:** Needs owner: it needs on-site work, which the owner arranges. **Product:** Discocan.

## Background

CB9405PE has had an eData since 2026-11-04. It reports only `417` (no CAN) and has never sent a
`405`, so Fleet gets no engine or tachograph data and fault reads mean nothing. Trucks on the
standard install work: CB1147TP, CB6721TE and CB6711TE (fleet-wide check on 2026-11-19, in
`.references/onsite/NOTES.md`).

## Goal

CB9405PE sends CAN data.

## Steps

1. Confirm in the relay journal that it still sends only `417`, and read the first byte of its
   latest `411` (bit 0 means CAN is present).
2. Look up the truck's make and model in Fleet and compare it with a working truck of the same
   make.
3. Draft a short Bulgarian message for the manager. Ask the installer to check the eData CAN wiring
   (CAN high and low on the eData's 6-pin connector, on the same CAN as the working trucks) and to
   confirm when it is done.
4. After the fix, check as in ticket 005, steps 1 and 3.

## Done when

`405` arrives with engine values and fault reads get a valid `154` reply.

## Limits

Read-only until the owner says otherwise.
