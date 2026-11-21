# 012 Close the on-site eData case

**Status:** Blocked: tickets 004 and 005 have to finish and the owner has to close the case.
**Product:** Discocan.

## Background

The CB8112XB and CB2792TK case keeps temporary material:

- `.references/onsite/` (Git-ignored): `NOTES.md`, the read-only listener and scan scripts, the
  command helper and the PDF for the on-site team;
- the memory note `cb8112xb-tachograph-2026-11-18.md` and its line in `MEMORY.md`, under
  `~/.claude/projects/-workspace-projects-holita/memory/`.

## Goal

Nothing temporary from the case is left behind.

## Steps

1. Ask the owner to confirm that the case is closed and whether any script should be kept (for
   example the read-only listener), and where.
2. Stop any listener process that still runs.
3. Move what the owner wants to keep, then delete `.references/onsite/`.
4. Delete the memory note and its `MEMORY.md` line.
5. Remove ticket 009 if the owner has decided it, and this ticket.

## Done when

The folder and the memory note are gone, and nothing still refers to them.
