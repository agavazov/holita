# 007 Trucks not reporting to Discocan

**Status:** Needs owner: re-routing a unit changes parameters that only the owner may change.
**Product:** Discocan.

## Background

As of 2026-11-19, four trucks did not report to the Discocan ERM server:

| Truck    | Since      | What is known                                                |
| -------- | ---------- | ------------------------------------------------------------ |
| CB1344XH | 2026-11-10 | Karma rewrote its primary server parameters (`0049`/`0050`). |
| CB9369PE | 2026-11-12 | Karma rewrote its primary server parameters (`0049`/`0050`). |
| CB5640XP | 2026-11-10 | Reason unknown.                                              |
| CB9680TE | never      | It has never reported to our server.                         |

Karma is only a fallback. Units are expected to come back to Discocan by themselves, as described
in [moving a unit](../../discocan/docs/development.md#moving-a-unit-between-karma-and-discocan). That
cannot happen when Karma has replaced the primary server.

## Goal

Every truck either reports to Discocan again or has a known reason and a plan.

## Steps

1. For each truck: last contact in the ERM database or the relay journal, and where it reports now.
   Karma access is described in `AGENTS.local.md`; read only the credential file you need and use
   Karma read-only.
2. Give the owner a short table: truck, last seen, where it reports, what is needed (re-routing by
   SMS, an on-site visit, or a unit that was never installed).
3. For re-routing, prepare the exact steps for the owner. Agents never send changes to `0049`–`0054`;
   the owner does it or gives another explicit instruction.

## Done when

The owner has the table and has decided for each truck. Close the ticket when each truck reports to
Discocan or the owner has dropped it.

## Limits

No writes to `0049`–`0054`. No Karma changes.
