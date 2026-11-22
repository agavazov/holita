# 241 Approve the shop retirement and purge contract

**Status:** Needs owner. Confirm cross-service retention and destructive shop removal policy. **Product:** Holita.

## Background

red.bg Backoffice deletes a store by running a purge across persisted data and files. Holita suspends a shop, while Core owns Branch and Commerce owns shop data and local media.

## Goal

Specify which suspended shop data can be removed and the required operational checkpoints.

## Steps

1. Confirm order, invoice, customer and file retention, role authorization, audit and whether any removal can be reversed.
2. Document the minimum scoped execution contract and service ownership so implementation can keep the Core Branch until eligible Commerce work is complete.

## Done when

The owner has approved concrete retention and scope rules and named the accountable authorization path.

## Limits

Planning only. No deletion on a live database or shared worktree.

## References

- [red.bg shop purge](../../../red.bg/workspace-ecommerce/services/api/app/Services/Operations/BackofficeStorePurgeService.php)
- [Holita tenancy rules](../../holita/AGENTS.md)
- [Core Branch foundation](../../docs/branches.md)
