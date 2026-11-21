# 014 Device Server: persistence

**Status:** Blocked: needs ticket 013. **Product:** Discocan.

## Background

Device Server has no database. Fleet imports reports through the contract's `reports` route and keeps
its own position in the generic `deviceCursor` table. Fleet already scopes Devices to the caller's
Tenant and Branch before it calls an adapter.

## Goal

Device Server stores reports, events, raw messages, the command queue and the configuration audit,
and serves the contract's read routes from that data.

## Steps

1. Add a database for Device Server in the existing PostgreSQL container (the only containerized
   infrastructure). Keep its database, settings and Prisma client inside `discocan/apps/device-server`.
2. Decide how Tenant and Branch are stored: Device Server receives data by IMEI, Fleet owns the
   registry. If both IDs are stored, `branchId` comes right after `tenantId`.
3. Write the Prisma schema and migration following the NestJS rules in `AGENTS.md`: camelCase
   identifiers with `@@map`/`@map`, concrete feature repositories, reviewed migration SQL.
4. Serve the read routes (reports with a cursor, events, messages, live state) from the database.
5. Tests stay within the budget: the cross-service contract and Tenant/Branch isolation only. Prefer
   extending `discocan/apps/device-server/src/device-contract.spec.ts`.

## Done when

Reports sent by a device are stored and Fleet imports them through the contract without gaps or
duplicates.
