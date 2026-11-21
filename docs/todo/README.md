# Project backlog

Open work as tickets: one Markdown file per task. Each ticket is written so that a session that has
not seen the earlier conversation can pick it up and finish it. [old/](old/) keeps the backlog from
before 2026-11-21 as reference. Its entries are not tickets; turn one into a ticket before working
on it.

## Tickets

Work top to bottom. Take `Ready` tickets first. `Needs owner` means the owner decides or approves
before the work starts; ask once, in plain words, and wait. `Blocked` names what it waits for.

| Ticket                                                                            | Status      | Product   |
| --------------------------------------------------------------------------------- | ----------- | --------- |
| [001 Check fault views after the device refactor](001-verify-fault-views-live.md) | Ready       | Discocan  |
| [002 Stale Karma routing label](002-stale-karma-routing-label.md)                 | Ready       | Discocan  |
| [003 Admin initial bundle over budget](003-admin-initial-bundle-budget.md)        | Ready       | Discocan  |
| [004 CB8112XB tachograph on the standard wiring](004-cb8112xb-tachograph.md)      | Ready       | Discocan  |
| [005 CB2792TK faulty eData](005-cb2792tk-replace-edata.md)                        | Blocked     | Discocan  |
| [006 CB9405PE eData without CAN](006-cb9405pe-edata-no-can.md)                    | Needs owner | Discocan  |
| [007 Trucks not reporting to Discocan](007-trucks-not-reporting.md)               | Needs owner | Discocan  |
| [008 CB8112XB plate in Fleet](008-cb8112xb-plate-in-fleet.md)                     | Needs owner | Discocan  |
| [009 CB2792TK connection parameter 0774](009-cb2792tk-parameter-0774.md)          | Needs owner | Discocan  |
| [010 Remote tachograph (.DDD) download](010-remote-ddd-download.md)               | Needs owner | Discocan  |
| [011 Files in .misc rewritten by Prettier](011-misc-prettier-check.md)            | Needs owner | Workspace |
| [012 Close the on-site eData case](012-close-onsite-case.md)                      | Blocked     | Discocan  |
| [013 Device Server: device-facing API](013-device-server-ingestion-api.md)        | Blocked     | Discocan  |
| [014 Device Server: persistence](014-device-server-persistence.md)                | Blocked     | Discocan  |
| [015 Commands to Discocan devices](015-discocan-device-commands.md)               | Blocked     | Discocan  |
| [016 Hardware model and parameters](016-hardware-model-and-parameters.md)         | Blocked     | Discocan  |
| [017 Measurement vocabulary for the hardware](017-measurement-vocabulary.md)      | Blocked     | Discocan  |
| [018 Track gaps per device type](018-track-gap-thresholds.md)                     | Blocked     | Discocan  |
| [019 ERM adapter inside erm-server](019-erm-adapter-into-erm-server.md)           | Blocked     | Discocan  |
| [Holita migration queue, tickets 100+](holita-migration.md)                       | Ready       | Holita    |

## Rules for every ticket

- Read [AGENTS.md](../../AGENTS.md) and the product's `AGENTS.md` first. The delivery policy, the
  test budget and the verification rules there apply to every ticket.
- One ticket at a time. Report to the owner after each one: what changed, which checks ran and what
  was not verified. Commit only when the owner asks.
- The machine is shared and often loaded. Check `free -h` and `uptime` before a build, a check or a
  Codex run. Run one heavy job at a time, and stop the processes you started.
- Live ERM services (`discocan-erm-server`, `discocan-erm-api`, `discocan-erm-recovery`) and their
  folders `apps/erm-server/live*` are not touched without the owner.
- Device actions on real trucks: reads, and temporary configuration with a restore, are allowed.
  Never send `1A`/`1B`, a reset, a firmware change or a change of parameters `0049`–`0054`. eData
  writes need the owner's explicit yes.
- Messages for the on-site team are in Bulgarian, plain and conversational: no "моля", no em dashes,
  no dialect. The owner forwards them.
- Never put credential values in tickets, commands or reports.

## Writing a ticket

- File name `NNN-short-slug.md`, numbered in creation order. Do not reuse a number.
- Sections: a status line (`Ready`, `Needs owner` or `Blocked`, with the reason), Background, Goal,
  Steps, Done when, Limits and References. Add a row to the table above.
- Write in English, keep proposals apart from implemented behavior and link the code or document
  that holds the facts instead of copying it.
- When the work is done or cancelled, delete the ticket file and its row.
