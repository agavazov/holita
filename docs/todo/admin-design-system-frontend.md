# Admin design system: frontend backlog

Pending frontend work only. The current screen, route, list, drawer and scoped-client behavior
is defined by the [Fleet implementation index](../discocan/fleet.md),
[Discocan architecture](../discocan/architecture.md#angular-admin-foundation) and
[admin design system](../admin-design-system.md). Use the existing live containers and their
focused tests when extending them; do not recreate the former screen build phases or a
Storybook persistence engine.

Product/release choices are indexed in the [main backlog](admin-design-system.md). API and
provider work belongs to the [backend backlog](admin-design-system-backend.md).

## Design-system coverage and cleanup

- Settle the proposed mobile "Filters (n)" toggle: implement it in the shared filter pattern
  or remove the proposal from the design. `activeFilterCount` currently has no view consumer;
  do not introduce a separate per-screen filter system.
- Extend `theme/contrast.ts` coverage to the neutral/accent solid states, dark accent tags,
  solid-button hover/active states and the notification unread badge where it is rendered.

## Release and visual review

Use the [release decisions](admin-design-system-review-fixes.md) for the Storybook PR gate and
PrimeUI key rotation, and the [main backlog](admin-design-system.md#release-decisions) for
production license configuration. These are independent of screen adoption.

Further visual refinement and baseline recording require the user's review under the
[Storybook procedure](../admin-design-system.md#storybook-review). Keep visual checks outside
CI until that decision changes; unapproved candidates are not baselines.

## Deferred extensions

These are later product choices, not requirements for synchronizing the approved Fleet screens:

- Mobile card layouts for additional lists if review requests them; a map view, saved list
  views and export.
- System color-scheme default and navigation counts, only with an explicit behavior/ownership
  decision and scope-retirement coverage.
- Shared account identity and a real notification feed after their contracts/providers exist;
  do not synthesize either from the current Tenant or Fleet business counts.
- Remove `styles/legacy-karma.scss` together with the temporary Karma Client's retirement.
- Screenshot baselines in CI, only after the user changes the current local-review policy.

Use [Discocan testing](../discocan/testing.md) and [shared testing](../testing.md) for current
focused commands and validation requirements. Individual failures/results belong in the task
response, not in this pending-work document.
