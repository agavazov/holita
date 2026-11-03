# ERM server: from proof of concept to the production control center

Plan for the owner's next sessions (2026-11-03). The proof of concept in
[`apps/erm-server`](../../apps/erm-server) ([ADR 0006](../architecture/decisions/0006-erm-device-server.md))
serves three test trucks, decodes every StarLink format they send and commands them; see the
[fleet control plan](erm-fleet-control-plan.md). This plan turns it into the production NestJS
service, completes the command, eData and error knowledge in parallel research sessions, and only then
builds the [operator interfaces](erm-control-center-interfaces.md).

## Problems the proof of concept cannot solve

1. **Every deployment disconnects the trucks.** The TCP sessions live in the same process as the
   decoders, commands and GraphQL, which change often. After a restart a unit returns only at its next
   scheduled transmission: up to 5 minutes driving, up to an hour parked (observed 2026-11-03).
2. **Decoding happens once, at capture time.** Stored frames cannot be decoded again when a decoder
   improves; the Trackers' binary reports before 13:24 have no events.
3. **Operations live outside the application.** Moving a unit (`route-unit`), lab sessions, parameter
   snapshots, Karma comparisons and the always-on switch are tools and scratch scripts; snapshots are
   private files; the second public port for configuration sessions does not exist.
4. **Knowledge is scattered.** Commands, result codes, events, eData payloads and diagnostic codes are
   in the protocol archive, the journal and code comments, not in one typed catalog.
5. **No Branch scope and no safe write path for operators.** GraphQL is provider-level and read-only;
   commands go through a token-protected REST endpoint.
6. **Shutdown loses close records** (2026-11-03, three restarts).

## Target architecture

One codebase (`apps/erm-server`), **two processes** started by two systemd units, sharing the
`holita_erm` database. PostgreSQL stays the only infrastructure, as `AGENTS.md` requires.

| Process            | Responsibility                                                                                                                                     | Changes                                     |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| `erm-gateway`      | Device TCP listener(s), sessions, framing, Karma relay while it exists, holita confirmations, command delivery, raw frame and connection records   | Rarely; a restart is planned with the owner |
| `erm-server` (app) | Decoding, events, commands catalog and queue, configuration snapshots, eData, diagnostics and alerts, routing operations, GraphQL and internal API | Often; restarts never touch trucks          |

They communicate through tables: the gateway appends frames (the inbox) and the app decodes them
asynchronously, with re-decoding for backfills; the app inserts commands (the outbox) and the gateway
delivers them, records the replies and result codes. `LISTEN`/`NOTIFY` wakes the other side. This is
the smallest change that solves problems 1 and 2: the gateway keeps only code that is already proven.

### Modules

| Module               | Content                                                                                                                                                                           |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `protocol` (library) | Framing, G9, checksums, text/`$SLB`/`$SLC` decoders, command builders; typed catalogs of commands, result codes, events, dynamic and system parameters generated from the archive |
| `gateway`            | Sessions, mirror/primary mode, keep-alive, configuration sessions on a second port, graceful shutdown that records closes                                                         |
| `telemetry`          | Decoded events, positions, report reasons, per-unit latest state, re-decoding                                                                                                     |
| `commands`           | Catalog with risk level (read, reversible, vehicle-acting, maintenance), queue for offline units, read-back and restore, audit                                                    |
| `configuration`      | Parameter snapshots as background jobs, diffs, protected parameters, change plans                                                                                                 |
| `edata`              | eData messages (`30`), payload decoders (`405`, `411`, `413`, `417`, `418`, `419`, `154`), fixed reads and configuration                                                          |
| `diagnostics`        | Unit errors (event 2 codes, power, jamming, removal, SIM), vehicle faults, connection health, silent-unit and Karma-revert alerts                                                 |
| `routing`            | Moving units between servers inside the app (replaces `route-unit`), always-on management, Simple SMS procedures                                                                  |
| `api`                | GraphQL with Branch scope through the Fleet `Device` entity, command mutations, internal API for jobs                                                                             |

Fleet keeps the business records; the device registry stays a Fleet `Device` with IMEI, model, SIM
and firmware. erm-server data is provider-level and resolved for a Branch through that entity.

## Phases

1. **Architecture session.** Write ADR 0007 for the two-process split and the module layout, then
   refactor in small steps behind the running service: library and catalogs first, then inbox
   decoding with backfill, then the gateway/app split. Deploy the gateway once, with the owner.
2. **Research sessions in parallel** (below), feeding the catalogs.
3. **Operations in the app:** routing, snapshots, always-on, the second public port; retire the tools.
4. **Branch scope and command mutations**, then the [interfaces](erm-control-center-interfaces.md).
5. **Fleet rollout:** route the remaining trucks one a day, then run without Karma per the
   [fleet control plan](erm-fleet-control-plan.md).

## Research sessions without worktrees

All sessions share `/workspace/projects/holita` on `main`; nobody creates a worktree or switches
branches for long.

| Session      | Owns (writes only here)                                                                             | Uses                                                  |
| ------------ | --------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| Architecture | `apps/erm-server/**`, ADR 0007, `docs/discocan/development.md`                                      | The only session that changes code and runs Nx checks |
| Commands     | `docs/discocan/erm-resources/starlink-commands.md` and its catalog data                             | Internal API on CB5636XP and CB5640XP                 |
| eData        | `docs/discocan/erm-resources/edata-simple-protocol-v4.04/` notes and a payload catalog              | eData fixed reads on the three test trucks            |
| Errors       | `docs/discocan/erm-resources/starlink-errors.md` (events, diagnostic and result codes, alert rules) | Stored frames and events, Karma history               |

Rules for all of them:

- Commit only your own paths (`git add <paths>`, never `git add -A`) and push after each commit;
  retry when the Git index is locked.
- Only the architecture session runs `npm run check`; research sessions write documentation and
  scratch scripts, not application code.
- Device commands go only through the internal API, one session per truck at a time; vehicle-acting
  and maintenance commands need the owner at a parked truck. Never read 0049–0054.
- Nobody restarts `holita-erm-server` (later `erm-gateway`) without the owner. The service runs
  `apps/erm-server/live`; deploy by copying `dist` there.
- Record findings in `.references/erm-relay/JOURNAL.md` with the session name; never print secrets.
- Questions for ERM collect in the [fleet control plan](erm-fleet-control-plan.md#questions-for-erm).
