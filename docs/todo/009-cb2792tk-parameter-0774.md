# 009 CB2792TK connection parameter 0774

**Status:** Needs owner. **Product:** Discocan (on-site case).

## Background

For the on-site work, CB2792TK's parameter `0774` was changed from 720 to 0 on 2026-11-18 at 17:55,
with the owner's approval. With 0 the unit keeps its connection while parked, which made remote
reads possible with the ignition off. It stayed connected through the night of 2026-11-19. The
price is more mobile data and battery use while parked.

## Goal

The owner decides whether to keep 0 or restore 720.

## Steps

1. Ask the owner, with the trade-off above, once ticket 005 no longer needs remote reads while
   parked.
2. To restore: send `04,0774,720` through the approved command path
   (`.references/onsite/scripts/cmd.mjs`, described in `.references/onsite/NOTES.md`).
3. Read the parameter back to confirm, and record the change in `NOTES.md`.

## Done when

The owner has decided and the unit has the chosen value, confirmed by a read.

## Limits

Restoring a temporary setting is allowed. Any other parameter change needs the owner.
