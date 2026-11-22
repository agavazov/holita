# 130 Audit what is still missing and plan it

**Status:** Ready after the wave 1-4 tickets. **Product:** Holita.

## Background

The owner asked on 2026-11-22 for a final phase: review what of red.bg's implemented merchant-shop,
Backoffice and Sales functionality Holita still lacks after waves 1-4, and implement it. The
exclusions in [the queue](holita-migration.md) still apply (external integrations, theme engines,
crawler, telephony).

## Goal

Every implemented red.bg feature in scope is either in Holita or has a ticket.

## Steps

1. Compare red.bg's implemented Admin, Backoffice, storefront and Sales screens and API behaviour
   (see [the inventory](../../holita/docs/red-bg/README.md)) with what Holita has now. Skip
   placeholders and the exclusions.
2. Also list quality gaps found in Holita itself: screens without empty, loading or error states,
   missing BG/EN texts, demo data that does not cover a feature, and backlog notes left by earlier
   tickets.
3. Write one ticket per gap (wave 5), numbered after the highest existing ticket, in dependency
   order and small enough for one Codex run, and add them to the queue.

## Done when

The queue holds a wave 5 ticket for each gap, or the audit states that nothing in scope is missing.

## Limits

Documentation only. Do not reopen decisions the owner already made.

## References

- [Queue](holita-migration.md), [Holita feature skill](../../.agents/skills/holita-feature/SKILL.md)
