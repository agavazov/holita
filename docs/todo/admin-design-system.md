# Admin design system

Pending product decisions, release work and design-system refinements. The current presentation,
Storybook workflow and shared patterns are documented in the
[admin design system](../admin-design-system.md). Connected Fleet screens and their contracts
belong to the [Fleet implementation index](../discocan/fleet.md) and
[Discocan architecture](../discocan/architecture.md); they are not implementation tasks in this backlog.

The remaining work is split between the [frontend backlog](admin-design-system-frontend.md),
[backend backlog](admin-design-system-backend.md) and
[release decisions](admin-design-system-review-fixes.md). Keep pending work here and actual
behavior in those authoritative product documents. Remove an entry when it is implemented;
report individual validation results in the task response.

## Provider integrations

Signal quality and voltage acquisition, firmware targets/policy, hardware command transport
including Restart, and notification delivery need real integrations that are unavailable in
the current scope. Keep their explicit Demo/unavailable presentation; do not simulate live
success or derive a notification feed from Fleet counts. Future work and contract dependencies
are in the [backend backlog](admin-design-system-backend.md#provider-integrations).

## Release decisions

- Decide whether affected-admin PR CI should run Storybook interaction and axe tests, following
  the [story-test gate proposal](admin-design-system-review-fixes.md#story-tests-as-a-pr-gate).
  Visual checks remain outside CI unless the user changes that decision.
- Configure the production PrimeUI license before public release. The current internal test
  release accepts the visible license notice; never hide it with CSS or JavaScript. Retain the
  local-file developer setup and exclude the local key from production/static Storybook output.
- Rotate the PrimeUI key retained in Git history, following the
  [rotation decision](admin-design-system-review-fixes.md#primeui-key-rotation). This requires the
  user's license action; removing it from the tracked file does not rotate it.

## Frontend refinements

Use the [frontend backlog](admin-design-system-frontend.md) for the mobile filter decision,
contrast coverage and small stylesheet cleanup. These do not require rebuilding connected
Fleet screens or replacing their retained API, query,
editor and batch tests.

## Visual review

Further visual refinement and baseline approval are a separate user review. Use the
[Storybook review procedure](../admin-design-system.md#storybook-review); take new candidates or
record/update baselines only when authorized. Approved baselines stay local and ignored, and
candidate images are not approval. The capture list is
`tools/browser/storybook-visual.spec.mts`.

## Deferred extensions

Keep future domain features in the [backend backlog](admin-design-system-backend.md#deferred-domain-work)
and optional presentation/product extensions in the
[frontend backlog](admin-design-system-frontend.md#deferred-extensions). They are proposals for
later scope, not missing Storybook-to-admin adoption.

Select required checks from [testing](../testing.md). Full regression requires an explicit
user/reviewer request. Do not keep a check-run journal or historical phase/agent ownership map
in this backlog.
