# 364 Reject duplicate source identifiers during import preview

**Status:** Ready. **Product:** Holita.

## Background

Independent review HLR-06 identified this behavior at `1b44cc90`. Two eligible rows with one source identifier can both be listed as additions. The write transaction then rejects the duplicate mapping and rolls back.

## Goal

Reject duplicate source identifiers during import preview.

## Steps

Check repeated normalized source identifiers for the appropriate source/entity scope while preparing the plan. Report a deterministic outcome before the operator approves.

## Done when

The preview exposes duplicate identities in a synthetic export and never promises two successful additions that the write rolls back. A clean export stays repeatable.

## Limits

Sales initial import planning and application. No live export or final transfer.

## References

- [holita-sales-import.mts](../../holita/tools/holita-sales-import.mts#L268)
- [holita-sales-import.mts](../../holita/tools/holita-sales-import.mts#L467)
- [holita-sales-import.mts](../../holita/tools/holita-sales-import.mts#L657)
- [holita-sales-import.mts](../../holita/tools/holita-sales-import.mts#L725)
