# Karma device management: session handoff

Date: 2026-10-24, Europe/Sofia.

**Status: the user is dissatisfied with the interface. The current UI is an unaccepted
Storybook prototype. This checkpoint preserves work for review; it is not design approval,
a completed production feature, or authorization to send device commands.**

## 1. Start here

- Repository: `/var/workspace/services/holita`, primary checkout, branch `main`.
  No separate linked worktree was created. Pre-checkpoint HEAD is `6118e4f`;
  main was 35 commits ahead of origin/main before this checkpoint. Do not push.
- This document is committed together with the current prototype and its related UI changes.
  Find that snapshot with `git log -1 -- docs/handoffs/2026-10-24-karma-device-management.md`.
- Report to the user in Bulgarian. Keep code, documentation and backlog entries in English.
- Read `AGENTS.md`, local instructions if present, and the focused admin/design-system and
  validation skills before editing. Current rules supersede the old review prompt's larger
  test matrix: at most 60 cases, smallest sufficient changes, no automatic Storybook suites.
- Run only one heavy task at a time. Stop Storybook before builds, Angular type checks or
  smoke checks. Use task-local `NX_PARALLEL=1`, `NODE_OPTIONS=--max-old-space-size=3072`
  and `GOMAXPROCS=2`. Do not start `npm run dev` just to review this prototype.
- Confirm no other session is editing this checkout. Previous subagents reviewed read-only;
  the main agent was the only writer.

## 2. Product intent and the latest user direction

The original task combined review corrections, relocation of device configuration into Karma,
and later cleanup. The immediate work evolved into a Storybook proposal so the user could
judge the workflow before production implementation.

The user's “filters” means **eData rules/conditions**, not inventory filter controls. They
want a clear interface for a truck's device, its parameter settings and its rules. They do
not want an invented management framework, many new abstractions, excessive code or speculative
edge-case handling. Existing Fleet Devices and other well-arranged Fleet screens are the visual
reference. Reuse their actual components and patterns; do not merely copy their markup.

The latest requested structure, implemented in the proposal but still not accepted visually:

1. Enter through **Karma → Trucks → selected truck** using the existing list and profile.
2. Open **Device settings as a truck-profile tab**, alongside Overview/eData/Location/etc.
3. Keep that profile navigation visible on the settings screen.
4. Display **Parameters above Rules**, both visible at once. No inner Parameters/Rules tabs.
5. Keep record links, compact filters, readable labels and restrained information cards.
   Do not expand technical data inside list rows or add duplicate entry buttons.
6. Keep advanced expression/event/byte details inside the rule drawer.

Several visual iterations were made. Successful checks do not establish that the user likes
or accepts the result. The next session should reassess the design with the user rather than
continue polishing this exact composition on the assumption that it is approved.

## 3. What exists now

### Storybook flow

Title: `Admin/Karma Client/Device management proposal`.

Full-flow URL, when the local server is running:
`http://localhost:11001/?path=/story/admin-karma-client-device-management-proposal--full-flow`

The full-flow story starts in Bulgarian inside the **real AdminWorkspace shell**, with its
sidebar, breadcrumb, language switch and Branch selector. It uses the existing CarsPage and
CarDetails. Story-only route overrides add
`/:language/karma-client/cars/:recordId/configuration`; an optional header-tab provider makes
Device settings visible throughout the profile, including from Location. The default production
header still has its original tabs. The production `karma.routes.ts` has no configuration route
and the old Fleet configuration route has not been moved or redirected.

The presenter owns transient per-car drafts and canned operation outcomes. Drafts survive
navigation between list, profile and settings while that story instance stays mounted. Language
switching retains those drafts. Reloading/rebootstrapping the story loses them.

**The list uses existing controlled Storybook fixtures: 61 sample cars. This is not the configured
Karma account or a newly measured device count.** The design references record a historical
read-only observation of 10 account cars on 2026-10-21/22; it was not rechecked in the UI work.
Fixture detail/location identities were made consistent for known sample cars, so selecting a
second truck works too. There is no new provider integration or real inventory reconciliation.

### Presentation behavior

- Parameters: choose a sample catalog entry and change its integer reporting interval.
- Rules: create, reopen, edit, duplicate and remove local drafts with the shared row-action
  and confirmation patterns. Build simple comparisons, add grouped AND/OR expressions,
  or use the advanced text/function/operator palette.
- Local draft UUIDs are not device rule IDs; protocol rule/event allocation is not implemented.
- The expression is a **string**. The readable rendering replaces numeric parameter references
  with sample catalog names. It is not an AST, parser, encoder or protocol validator.
- Numeric fields have integer/range checks. A nonempty expression can still be invalid syntax.
  No encoded-byte count, firmware arithmetic validation or complete condition semantics exist.
- Imported `sourceHex` remains the original read-only bytes when a draft is edited/duplicated.
  It is labelled as original and is not regenerated from the edited expression.
- Save and send records a **canned preview outcome** in memory. It does not persist intent,
  invoke Fleet, queue command 301 or confirm anything on a device.
- Settings uses fixture Branch choices from the shell. It does **not** select/verify a real scoped
  Fleet Device, reconcile an IMEI, establish a persistent link or prove authorization.
- Existing status labels are reused from the Fleet operation catalogs; no new lifecycle state
  or migration was introduced. Loading/empty/error/waiting/uncertain/dark/mobile stories remain.

### Changes that also affect normal application presentation

These are not confined to Storybook, so inspect them before replacing or reverting the prototype:

- CarsPage uses shared PageHeader/FormField/TablePanel, record anchors, a real displayed count,
  compact search/project controls and two visible columns (vehicle/model, project). Technical
  row disclosures and redundant Settings buttons were removed. Its native detail links remain.
- CarDetails uses shared page/card/facts patterns. Summary references show project/time-zone
  names without ID suffixes; raw identifiers remain in the optional source disclosure.
- KarmaCarHeader supports optional localized extra tabs and hiding its refresh action. The
  proposal provides the extra settings tab only from its Storybook root. Its header-action slot
  is still needed for the settings view's Save and send control.
- TablePanel no longer puts an alert role around a PrimeNG Message that already has one.
- Existing Karma smoke expectations follow the intentionally changed presentation.
- CarsPage story play assertions were removed while useful manual scenarios were retained,
  following the current repository policy. Do not restore a large automatic UI suite by default.

No backend, SDL, migration, command allowlist, production configuration route, dependency,
legacy Karma stylesheet or real-device write was added by this prototype work.

## 4. Code and document map

Paths below are relative to the repository root.

| Area                                                             | Entry points                                                                                                                                     |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Settings presentation, forms, local output events                | `apps/admin/src/app/features/karma-client/device-management/device-management-view.ts`, `.html`, `.scss`, `i18n/`                                |
| Scenario variants and full-flow entry                            | `apps/admin/src/app/features/karma-client/device-management/device-management-view.stories.ts`                                                   |
| Story-only routes, root draft state and profile/settings adapter | `apps/admin/src/storybook/karma-management-scenario.ts`                                                                                          |
| Existing fixture account/details/location                        | `apps/admin/src/storybook/karma-fixtures.ts`                                                                                                     |
| Real inventory, query behavior and list stories                  | `apps/admin/src/app/features/karma-client/cars/cars-page/`                                                                                       |
| Real truck overview                                              | `apps/admin/src/app/features/karma-client/cars/car-details/`                                                                                     |
| Profile tabs, list-return context and optional tab provider      | `apps/admin/src/app/features/karma-client/car-header/`                                                                                           |
| Shared alert fix                                                 | `apps/admin/src/app/ui/table-panel/table-panel.html`                                                                                             |
| Existing browser regression case                                 | `tools/browser/angular-karma.smoke.spec.mts`                                                                                                     |
| Main style references                                            | `apps/admin/src/app/features/fleet/devices/devices-view.*`, `features/fleet/vehicles/vehicle-profile-view.*`, `app/ui/`, `styles/_patterns.scss` |

Authoritative references and pending work:

- [Design system](../admin-design-system.md), [testing policy](../testing.md).
- [Current device-operation architecture](../discocan/architecture.md#background-device-configuration-reads).
- [Open review/cleanup backlog](../todo/review-corrections-and-karma-management.md).
- [Pending production proposal](../todo/karma-device-management-design.md).
- [Proposed identity/scope ADR](../todo/karma-device-management-identity-adr.md).
- [Parameter configuration backlog](../todo/erm-edata-configuration-interface.md) and
  [Karma API backlog](../todo/karma-api-v2.md).
- [Karma API references](../discocan/erm-resources/karma-api-v2/endpoint-catalog.md) and
  [parameter protocol evidence](../discocan/erm-resources/edata-simple-protocol-v4.04/parameter-reporting.md).

The proposal links additional Git-ignored local rule research. Those files were not read for this
handoff. Do not enter `.misc/` or `.tmp/` without the current task's explicit authorization.
Keep the open backlog as the source of pending work; this handoff is a dated snapshot, not a
replacement architecture or a second backlog.

## 5. Problems found, and their present status

| Finding                                                                                                            | Status at handoff                                                               |
| ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------- |
| Crowded prototype, separate-screen impression, weak hierarchy and excessive technical controls                     | Several iterations made; **user remains dissatisfied. UX approval is open.**    |
| Native-looking vehicle buttons used a nonexistent `.app-record-link` class                                         | Replaced with real anchors and existing `.app-link`/identity styles.            |
| Technical disclosures expanded table rows and duplicate Settings actions added clutter                             | Removed from inventory/rule rows; advanced rule data stays in the drawer.       |
| Giant device context, unknown connection label, empty history and inner settings tabs                              | Removed/restructured; panels now stack under the profile settings tab.          |
| Mobile row menus were outside the visible table area                                                               | Existing Fleet mobile-action pattern applied and reviewed in the browser.       |
| Duplicate nested alert roles and two Retry controls after inventory refresh failure                                | Fixed; existing Karma smoke passes the outage/recovery path.                    |
| Early strict-template/lint issues, fractional integer input, hidden numeric errors, lost source bytes              | Fixed during the prototype review; later focused gates passed.                  |
| Story router providers added routes instead of replacing them; feedback could follow a different car               | Corrected by story-local resetConfig and clearing notices with route changes.   |
| Header action disappeared across projection boundaries during full-flow composition                                | Projection alias corrected, then entry was moved to a profile tab as requested. |
| Missing production route, real Fleet target selection, durable drafts/operations, parser/encoder and import/export | **Still missing. Do not present the preview as those features.**                |

Independent read-only reviews found no remaining concrete source regression in the last revision.
That is limited source/browser evidence, not a full audit of earlier commits or proof of product
quality, protocol correctness, persistence or restart recovery.

## 6. Earlier review work: do not restart it blindly

Before the uncommitted prototype, main already contained the original durable configuration
commits `ed8fe51` and `348f701` and many subsequent corrections. Recent relevant commits include:

- `f57845b`: list actions during refresh.
- `9fcbf9e`: typed field reason codes and admin mappings.
- `fb1f3ae`: inactive-vehicle assignment error.
- `f4a3aa2`: editors remain open until saves settle.
- `b71608d`: instant inputs use the Branch time zone.
- `6118e4f`: 60-case budget and affected-only verification policy.

These history entries are not a new verification of Milestones 1/2. Consult the current backlog
and actual code before repeating old scratchpad findings or claiming the earlier baseline complete.
The local development migration state was not checked again for this handoff. Before any future
migration work, inspect whether `20261021000000_device_configuration_reads` and
`20261021100000_device_parameter_changes` were applied; never edit an applied migration.

P3 measurement and the named behavior-preserving cleanup remain open in the review backlog.
Measure first; do not optimize from line counts or start repository-wide refactors. Original
Milestone 4 remains a separately reported scope after the feature decisions.

## 7. Remaining work and a sensible next-session order

1. **Reassess UX and agree one coherent screen flow.** Read this checkpoint, compare the actual
   Fleet Devices/profile patterns, and review the existing implementation critically. Keep the
   latest structural requests unless the user changes them. The new view/scenario may be
   simplified or replaced; do not treat the checkpoint as a requirement to preserve scaffolding.
   Seek concrete visual agreement before extending production behavior.
2. **Connect the existing parameter workflow after approval.** Add the real Karma entry/route and
   old-route redirect, resolve an authorized Branch and local Fleet Device, keep per-request
   upstream target selection, and reuse the actual durable Fleet operations/history. Do not
   connect the current in-memory Save and send handler to an arbitrary provider call.
3. **Finish local rule authoring as a separate focused feature.** One ID-based AST/parser/encoder,
   syntax/byte validation, supported grouping/functions, preserved unknown definitions, truthful
   units/catalog names, browser-persistent scoped drafts and evidence-backed INI/TXT import/export.
   Arbitrary sample expressions are examples, not deployment defaults or a complete compiler spec.
4. **Implement online rule operations only after explicit approval.** Extend the fixed provider
   contract, typed Fleet operation kinds/snapshots and additive persistence as the approved design
   requires. Keep independent verification and uncertain-write behavior. Cleanup is separate.

Specific production gaps to resolve before sending anything:

- Karma account-wide visibility is not Tenant/Branch authorization. An opaque upstream device ID
  must never be assumed equal to an IMEI. The proposed ADR retains explicit per-request target
  selection, with no synchronization, mapping table or automatic linking.
- Preserve the full captured configuration, including unknown/unrelated settings. Retain baseline
  comparison, the 120-second preflight and an independent complete verification read.
- Persist intended changes, requests, results, errors and progress across reload/navigation/service
  restart. Submission/queue acceptance is never confirmation. An uncertain write is never replayed.
- Provider calls stay in `apps/karma-client`; Fleet uses machine-authenticated internal endpoints
  and retains durable jobs/history. No server-side rule engine or arbitrary command console.
- Current documented command 301 allowlist: `0702BC`, `1F`, and `02` plus one 22-byte parameter
  definition. Proposed rule additions `0802BC` and `04` plus one validated rule record are **not
  approved**. Do not add replace-all, delete-all, restart or profile/global writes.
- Real-device reads also queue device commands. Each run needs named devices or explicit approval
  to read all; a write/restart also needs the exact change. Do not repeat the earlier battery write.

## 8. Validation evidence and its limits

Last source-changing revision was checked on 2026-10-23. Existing local logs were reread for this
handoff; these are historical results, not fresh execution on 2026-10-24:

| Command/review                                                                   | Recorded result                                                                             |
| -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `NX_PARALLEL=1 npm run check`                                                    | Exit 0; fresh admin build, 6 unit files / 9 cases passed, lint passed; 1/3 Nx tasks cached. |
| `NX_PARALLEL=1 npm run test:smoke:admin -- angular-karma.smoke.spec.mts`         | Exit 0; 1 executed / 1 passed, 1 worker; 12/13 tasks cached.                                |
| `npm run typecheck:tools`                                                        | Exit 0.                                                                                     |
| `./node_modules/.bin/ngc --noEmit --project apps/admin/.storybook/tsconfig.json` | Exit 0; checks the story-only presentation omitted from production routes.                  |
| Manual browser review                                                            | 19 checkpoints passed, no browser errors, no desktop axe violations.                        |

The manual review covered the full shell flow, active profile tab (also from Location), actual
vertical panel bounds, keyboard links, parameter/rule draft actions, source-byte preservation,
per-car navigation retention, EN/BG switching, missing scope, mobile and state variants. It is an
ignored review helper, **not 19 repository test cases or exhaustive accessibility coverage**.
No visual baselines were created/updated. Earlier initial lint failures were corrected before the
successful gates. No full suite, fresh backend audit, live-device test, protocol compiler test or
production persistence/restart test was established by this UI work.

Optional local evidence is under `.references/review/karma-storybook-preview-20261022/`:
`check-stacked.log`, `smoke-stacked.log`, `tools-stacked.log`, `stacked-types.log`,
`browser-stacked.log`, `review-stacked.cjs` and temporary captures. Those ignored files are not
part of the commit; this document contains the essential results if they are absent elsewhere.
The earlier 49/60 test-budget result was not rerun for this handoff; no test case was added.

On 2026-10-24 the handoff-time `NX_PARALLEL=1 npm run check` also exited 0, with all 3/3 Nx
results reused from cache and lint successful. **Zero test cases were freshly executed by that
handoff check**; its displayed 9 passing cases are cached evidence. No new smoke/type/browser
run was made merely for writing this document. The local log is
`check-handoff-20261024.log` in the optional evidence directory above.

## 9. Safe environment and preview restart

At handoff preparation, no listener was present on port 11001. Earlier messages saying Storybook
was running describe their earlier handover, not a guarantee that it is still running now.
Do not terminate unrelated Node processes or shared services. WSL was previously overloaded and
intermittently failed with `Wsl/Service/0x8007274c`; the user restarted it. Never restart WSL without
explicit approval.

In the current Linux shell, Node is installed at the following local path. Adjust only if it is
absent; use an explicit Linux workdir rather than the desktop app's malformed Windows/UNC cwd:

```bash
cd /var/workspace/services/holita
export PATH=/home/agavazov/.nvm/versions/node/v24.21.0/bin:$PATH
export NODE_OPTIONS=--max-old-space-size=3072
export GOMAXPROCS=2
npm run storybook --workspace @holita/admin
```

Wait for preview compilation to finish before browser review. Stop that server before running
`NX_PARALLEL=1 npm run check` or a matching smoke/type gate. Do not use `test:full`, run broad
suites, update visual baselines, reset databases, delete branches/worktrees, push or open a PR
unless separately requested. Use dedicated test databases when a relevant DB test is required.

Never read/print/commit `apps/admin/public/config.local.json`, credential values, env files,
generated clients, build output or caches. The temporary browser review intercepted the protected
config URL with a safe empty response; do not inspect the real file to remove a license banner.
Use credential locations only through `AGENTS.local.md` for an explicitly authorized account task.

## 10. Suggested opening request for the next session

Read this handoff and the current repository instructions. The user has not accepted the Karma
interface. Review the checkpoint critically against Fleet Devices, keep the requested truck-profile
settings tab and stacked Parameters/Rules, and propose the smallest clear visual correction.
Use the real shell and existing pages in Storybook. Do not extend production routing, compile/send
rules or run device commands without the relevant approval. Use one heavy task at a time and
report in Bulgarian. Check the current branch/status before editing; do not redo verified earlier
review fixes without evidence of a remaining defect.
