# Admin design system

Pending product decisions, release work and presentation refinements. Current presentation,
Storybook workflow and shared patterns are documented in the
[admin design system](../admin-design-system.md). Connected Fleet screens and their contracts
belong to the [Fleet implementation index](../discocan/fleet.md) and
[Discocan architecture](../discocan/architecture.md).

This backlog owns frontend and release work; the
[backend backlog](admin-design-system-backend.md) owns API and provider work. Keep only pending work here.

## Provider integrations

Signal quality and voltage acquisition, firmware targets/policy, Restart and other unsupported
hardware commands, and external email/SMS notification delivery require real integrations. The supported command
301 eData configuration reads, additions and interval changes do not establish support for
other commands. Keep explicit Demo/unavailable presentation for unsupported capabilities;
do not simulate live success or derive a notification feed from Fleet counts. Contract
dependencies belong to the [backend backlog](admin-design-system-backend.md#provider-integrations).

## Release decisions

- Decide whether to purchase an admin theme.
- Configure the production PrimeUI license before public release. The internal test release
  accepts the visible license notice; never hide it with CSS or JavaScript. Retain the
  local-file developer setup and exclude the local key from production/static Storybook output.
- Rotate the PrimeUI key retained in Git history through the license provider. This requires
  the user's license action; removing it from the tracked file does not rotate it. Never read,
  print or commit the local license file or copy its key into documentation. Remove this entry
  after rotation; keep the separate production license task until public-release configuration
  is ready.

## Deferred extensions

These require later product scope:

- Mobile card layouts for additional lists if review requests them; saved list
  views and export.
- System color-scheme default and navigation counts, with an explicit behavior/ownership
  decision and scope-retirement coverage.

Domain features belong to the [backend backlog](admin-design-system-backend.md#deferred-domain-work).
Choose checks with [testing](../testing.md).
