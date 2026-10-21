# Admin design system

Pending product decisions, release work and presentation refinements. Current presentation,
Storybook workflow and shared patterns are documented in the
[admin design system](../admin-design-system.md). Connected Fleet screens and their contracts
belong to the [Fleet implementation index](../discocan/fleet.md) and
[Discocan architecture](../discocan/architecture.md).

This backlog owns frontend and release work; the
[backend backlog](admin-design-system-backend.md) owns API and provider work. Focused review
corrections and the Karma device-management proposal remain in
[review corrections](review-corrections-and-karma-management.md). Keep only pending work here.

## Provider integrations

Signal quality and voltage acquisition, firmware targets/policy, Restart and other unsupported
hardware commands, and notification delivery require real integrations. The supported command
301 eData configuration reads, additions and interval changes do not establish support for
other commands. Keep explicit Demo/unavailable presentation for unsupported capabilities;
do not simulate live success or derive a notification feed from Fleet counts. Contract
dependencies belong to the [backend backlog](admin-design-system-backend.md#provider-integrations).

## Release decisions

- Implement the user-approved Storybook interaction/axe gate in affected-admin PR CI after
  Chromium installation. Update the [testing guidance](../testing.md#github-actions) and
  validate the workflow with `actionlint`, preserving real event base/head selection and
  manual-only full regression. Visual checks remain outside CI unless the user changes that
  separate decision.
- Decide whether to purchase an admin theme.
- Configure the production PrimeUI license before public release. The internal test release
  accepts the visible license notice; never hide it with CSS or JavaScript. Retain the
  local-file developer setup and exclude the local key from production/static Storybook output.
- Rotate the PrimeUI key retained in Git history through the license provider. This requires
  the user's license action; removing it from the tracked file does not rotate it. Never read,
  print or commit the local license file or copy its key into documentation. Remove this entry
  after rotation; keep the separate production license task until public-release configuration
  is ready.

## Frontend refinements

- Settle the proposed mobile "Filters (n)" toggle: implement it in the shared filter pattern
  or remove the proposal from the design. `activeFilterCount` has no view consumer;
  do not introduce a separate per-screen filter system.
- Extend `theme/contrast.ts` coverage to the neutral/accent solid states, dark accent tags,
  solid-button hover/active states and the notification unread badge where it is rendered.

## Visual review

Further visual refinement and baseline approval require user review. Use the
[Storybook review procedure](../admin-design-system.md#storybook-review); take new candidates or
record/update baselines only when authorized. Approved baselines stay local and ignored, and
candidate images are not approval. The capture list is
`tools/browser/storybook-visual.spec.mts`.

## Deferred extensions

These require later product scope:

- Mobile card layouts for additional lists if review requests them; a map view, saved list
  views and export.
- System color-scheme default and navigation counts, with an explicit behavior/ownership
  decision and scope-retirement coverage.
- Shared account identity and a real notification feed after their contracts/providers exist;
  do not synthesize either from the current Tenant or Fleet business counts.
- Remove `styles/_legacy-karma.scss` after its remaining consumers are gone.
- Screenshot baselines in CI, after the user changes the local-review policy.

Domain features belong to the [backend backlog](admin-design-system-backend.md#deferred-domain-work).
Select required checks from [Discocan testing](../discocan/testing.md) and
[shared testing](../testing.md). Full regression requires an explicit user/reviewer request.
