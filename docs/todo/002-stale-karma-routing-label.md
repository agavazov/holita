# 002 Stale Karma routing label

**Status:** Ready. **Product:** Discocan (Fleet and admin).

## Background

Fleet's `ermDevice` table has routing columns: `routing`, `routingObservedAt`, `backupSince`,
`lastBackupStartedAt`, `lastBackupEndedAt` and `backupSeconds`. They were copied from the removed
Karma Client by migration `20261106000000_remove_karma_client` and moved to `ermDevice` by
`20261119000000_device_type`. Nothing in the repository has written them since 2026-11-06.

Fleet still returns them as the Device's routing health
(`discocan/apps/fleet/src/modules/devices/devices.service.ts`, around the `routingObservedAt`
mapping). The admin shows them as a "Karma backup since …" tag
(`discocan/apps/admin/src/app/ui/fleet-live/fleet-connection.ts`, which uses `karmaBackup` from
`features/erm/karma-connection.ts`). As a result, CB2792TK shows a Karma backup since 11-06 while it
reports to the Discocan ERM server.

The current routing comes from the ERM subgraph (`ermRouting`). The Karma routing card
(`discocan/apps/admin/src/app/features/erm/karma-routing-card.ts`) already uses it.

## Goal

No screen presents the frozen Fleet values as the current routing.

## Steps

1. Confirm the problem: compare the `ermDevice` routing columns in the development database
   (read-only) with `ermRouting` for the same Devices.
2. List every reader of the frozen fields in Fleet and the admin (`routingHealth`, `karmaBackup`,
   `backupSince` and so on).
3. Make the smallest fix. Either show the backup tag from `ermRouting`, or stop returning the frozen
   fields and drop the tag where `ermRouting` is not available. Choose the smaller change.
4. Dropping the database columns would need a reviewed migration and the owner's approval. It is not
   part of this ticket; propose it in the report if it makes sense.

## Done when

CB2792TK shows no Karma backup. A truck that really reports to Karma still shows it, if the ERM data
says so.

## Limits

- No change to `erm-server` runtime code (the live units run from deployed copies).
- Database access is read-only.

## References

- [Karma role and routing](../../discocan/docs/development.md#moving-a-unit-between-karma-and-discocan)
