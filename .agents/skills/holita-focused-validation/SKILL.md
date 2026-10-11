---
name: holita-focused-validation
description: Select and run focused checks for changes in the holita workspace, including file/case selection and local-versus-PR affected checks. Use when implementing or verifying repository changes.
---

# Focused validation

Read [the test policy](../../../docs/testing.md) and the change's relevant source. Mandatory
rules remain in [AGENTS.md](../../../AGENTS.md).

1. Inspect the current Git diff and untracked files, excluding `.tmp/` and `.volumes/`.
   Distinguish this work from the full PR comparison; choose real base/head references.
2. Start with one relevant project/file/case. For backend behavior use
   [products.service.spec.ts](../../../apps/products/src/products/products.service.spec.ts):
   `npm run test:products -- products.service.spec.ts`, narrowed with
   `--testNamePattern="rejects invalid input"`. Use health.spec.ts for bootstrap changes.
3. Match the change to the authoritative mapping in docs/testing.md. Root configuration
   can affect all projects; do not hide that impact with an artificially narrow report.
4. Use `--skip-nx-cache` when demonstrating argument forwarding or actual runtime execution.
   Read executed test counts; missing files and all-skipped cases are not passed validation.
   For persistence changes, first run `npm run db:up`, `npm run db:setup` and
   `npm run db:test:setup`, then use `npm run test:products:db -- persistence.db.spec.ts`
   (or core). Narrow with `--testNamePattern="rejects duplicate SKU"` when relevant.
   See [the real products DB tests](../../../apps/products/test/persistence.db.spec.ts).
   These targets are noncached and migrate into guarded per-run test schemas. Preserve
   that cleanup boundary; never substitute development URLs or broad reset/truncation.
   Products GraphQL/store-scoping changes use products.db.spec.ts. Communication and
   federation changes use `npm run test:gateway:db -- federation.db.spec.mts`, which starts
   real backend processes and isolated schemas. SDL/operation changes also need codegen,
   schema:check and `test:schema -- contracts.unit.spec.mts`. See the authoritative mapping.
5. Report exact commands, selected files/cases, results and unverified contracts. Clean up
   listeners/connections started by the checks.

For Angular admin, use `test:admin -- --include=app/features/products/products-api.spec.ts`
and `--filter="case name"` for Angular CLI native selection. Store routing uses
`--include=app/features/stores/store-workspace.spec.ts`. These tests use actual Apollo and
Angular HTTP testing, including late mutation success/failure and A → B → A. Real reads use
`test:smoke:admin -- angular-foundation.smoke.spec.mts` against the compiled application and
dedicated database fixture. Editor forms/guards/late callbacks use
`test:admin -- --include=app/features/products/product-editor.spec.ts`; real create/update
and SKU conflicts use `test:smoke:admin -- angular-product-editor.smoke.spec.mts`.
Single/page-local deletion uses `test:admin -- --include=app/features/products/products-deletion.spec.ts`
for partial results, stopping unsent writes and captured-client shutdown. Real persistence,
partial failures, retry and last-page correction use
`test:smoke:admin -- angular-products-delete.smoke.spec.mts`. These checks do not prove upload behavior.

For Angular Reference availability, Venues, Speakers, Tags and Events, select
`test:admin -- --include="app/features/reference/**/*.spec.ts"` (or the owning file).
The boundary checks disabled routes/unknown stores and section-preserving routing. Concrete
resource suites cover Apollo scope, list queries, typed validation/null mapping, server-field
focus, dirty editors and sequential deletion retirement. Use
`test:smoke:admin -- angular-venues.smoke.spec.mts` for real persistence, nullable sorting,
referenced failures/retry, delayed reads/writes, disabled Reference and Bulgarian mobile themes.
Use `test:smoke:admin -- angular-lookups.smoke.spec.mts` for Speaker nullable Email/biography,
Email null-last sorting, Tag HEX preview/lowercase and duplicate Name focus, referenced rows
retained through Event Trash, partial retry and scoped dirty/pending navigation.

Use `test:admin -- --include="app/features/reference/events/*.spec.ts"` and
`--include=app/features/reference/relation-picker.spec.ts` for Event typed inputs, Sofia DST/exact
instants, decimal strings, HTML boundaries, retired writes and remote read cancellation.
Use `test:smoke:admin -- angular-events.smoke.spec.mts` for real Event fields/relations,
remote paging, inactive labels, list URL/columns, rich text, dirty navigation, A → B → A and
BG desktop/mobile light/dark review. Use `test:smoke:admin -- angular-lifecycle.smoke.spec.mts`
for atomic status/Trash/Restore rollback/retry, reserved Code/child preservation, read-only
Trash, paginated plain-text History, delayed bulk actions and lifecycle dialogs/mobile themes.
Use `test:admin -- --include="app/features/reference/sessions/*.spec.ts"` for typed parent
bounds/Sofia/nullable inputs, program drafts/reload conflicts, read cancellation, copied IDs,
retired writes and editor callbacks. Use `test:smoke:admin -- angular-sessions.smoke.spec.mts`
for real CRUD/Speaker relations, protected Event bounds, complete-set ordering, dirty tabs,
History, Trash/Restore, delayed parent/editor/store navigation and Sakai desktop/mobile themes.
Use `test:admin -- --include=app/features/reference/media/media-api.spec.ts` for captured
Media clients/headers, read retirement, intent/binary cancellation, late finalization,
complete order IDs and Alt text mapping. Use `test:smoke:admin -- angular-media.smoke.spec.mts`
for actual persisted bytes, metadata/cover/removal, drag/order conflict/retry, independent
Event drafts, cancellation, store/Event retirement, preview renewal, Trash/Restore and Sakai
progress/dialog/mobile themes. Reference CORS configuration uses
`test:reference -- admin-origins.spec.ts`.

For Angular shell work, select `angular-shell.smoke.spec.mts` through `test:smoke:admin`
and compare holita with the pinned [Sakai source](../../../docs/development.md#sakai-source-reference).
Review light/dark themes, collapsed/expanded navigation, open overlays and matching
desktop/mobile viewports; report visual review separately from behavioral results.

Never invoke `test:full` during implementation unless explicitly requested. Do not invent
a selector framework; use the native runners behind the named npm scripts.

For CI changes, inspect [PR affected](../../../.github/workflows/affected.yml) and
[manual regression](../../../.github/workflows/full-regression.yml), then follow the
[CI validation procedure](../../../docs/testing.md#github-actions). Keep PR base/head
verification ahead of affected selection, check non-TypeScript input impact, and distinguish
local workflow validation from an actual GitHub run. Do not dispatch full regression to
validate a workflow edit unless the user explicitly requests that run.

For a combined Angular presentation/startup review, use
`test:smoke:admin -- angular-parity.smoke.spec.mts`. It covers both languages and themes,
991/992px resizing with retained drafts, saved long labels in overview/child editors and localized startup alerts. Browser cases retain dedicated
database schemas. Parent overview recovery
with a dirty Session order uses `test:admin -- --include=app/features/reference/events/event-overview.spec.ts`.
