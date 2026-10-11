---
name: holita-focused-validation
description: Select focused native checks for changes in holita, including current diff and PR affected selection. Use when implementing or verifying repository changes.
---

# Focused validation

Read [AGENTS.md](../../../AGENTS.md) and [testing](../../../docs/testing.md).
Domain check mappings are in [Discocan testing](../../../docs/discocan/testing.md) and
[Ecommerce Stores](../../../docs/ecommerce/stores.md#validation). Select by changed behavior;
current telemetry Store scope does not make Fleet tests Ecommerce feature coverage.
Inspect tracked/untracked changes while excluding `.tmp/` and `.volumes/`. Distinguish local
changes from the broader PR diff and use real base/head commits.

Start with one relevant file/case through root native targets. Backend examples:
`test:fleet -- vehicles.service.spec.ts`, `test:fleet -- devices.service.spec.ts`,
or the affected backend's health.spec.ts for bootstrap. Use --testNamePattern for Jest and
--skip-nx-cache for actual execution. Read test counts; zero/all-skipped tests are not success.

SDL/operation changes require codegen, schema:check and test:schema. Persistence changes
require db:up, db:setup and db:test:setup, then owning test:core:db/test:fleet:db targets.
Use vehicles.db.spec.ts/devices.db.spec.ts for Fleet. Dedicated guarded helpers deploy
migrations into per-run schemas and drop only their schemas; never substitute development URLs
or broad reset/truncation. Live DB results must not be cached.

Cross-service behavior uses test:gateway:db -- federation.db.spec.mts with real Core/Fleet
processes/schemas. Angular uses test:admin with --include paths relative to apps/admin/src and
--filter for case selection. Select concrete Vehicles/Devices API/query/editor/deletion suites,
StoreWorkspace/FleetWorkspace, RelationPicker, transport/config/appearance as affected.
Use VITEST_MAX_WORKERS=1 on constrained hosts without reducing case coverage or changing deadlines.

Compiled-app browser checks use test:smoke:admin with angular-vehicles, angular-devices,
angular-foundation or angular-shell smoke files. Match the behavior to the authoritative mapping.
Review shell/feature desktop/mobile light/dark visuals at matching Sakai viewport sizes; keep
behavioral evidence separate from visual review. Captures stay in ignored .references/review.

Root tooling changes require root lint/typecheck/build plus affected behavior. CI changes
require actionlint/ShellCheck and explicit Nx impact examples; actual PR runs use event base/head,
fail on missing history and do not replace selection with full regression. Manual regression
remains workflow_dispatch only. Never invoke test:full automatically.

Report exact commands/counts and unverified work. Clean up task-started connections/processes.
Do not enable watch/passWithNoTests or invent another selector framework. Update authoritative
product docs for implemented behavior; put individual run results only in the task response.
