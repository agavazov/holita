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

For admin, select product-list.test.tsx, product-form.test.tsx, data-provider.test.ts or store-workspace.test.tsx
through test:admin. The workspace file uses actual Refine hooks/cache with controlled HTTP
responses and supports `--testNamePattern="captures a pending create"`. Use this long option
through Nx because Nx reserves -t for targets. Real browser behavior uses
`test:smoke -- products.smoke.spec.mts`, narrowed by Playwright `--grep="pending mutation"`.
Read docs/testing.md for Chromium/test-DB prerequisites; the fixture owns its processes and
schemas. Do not add heading assertions or passWithNoTests to make an aggregate green.
Health/component mocks do not establish actual database or federation isolation.

For shared admin navigation, also select `reference-layout.smoke.spec.mts`; include
`reference-disabled.smoke.spec.mts` when menu visibility or route availability changes.
For Aurora shell changes, compare the source and holita at matching viewport sizes,
including collapsed/expanded navigation, open menus and mobile drawer behavior. Report
visual review separately from behavioral test results. Capturing the source theme alone
does not validate the holita integration.

Never invoke `test:full` during implementation unless explicitly requested. Do not invent
a selector framework; use the native runners behind the named npm scripts.

For CI changes, inspect [PR affected](../../../.github/workflows/affected.yml) and
[manual regression](../../../.github/workflows/full-regression.yml), then follow the
[CI validation procedure](../../../docs/testing.md#github-actions). Keep PR base/head
verification ahead of affected selection, check non-TypeScript input impact, and distinguish
local workflow validation from an actual GitHub run. Do not dispatch full regression to
validate a workflow edit unless the user explicitly requests that run.
