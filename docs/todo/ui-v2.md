# Admin UI v2 follow-ups

Pending acceptance and deployment work only. The implemented navigation, sign-in, notifications,
command/SMS workflows and shared presentation belong to
[Discocan development](../discocan/development.md) and the
[admin design system](../admin-design-system.md).

- Perform the owner/Claude Storybook visual acceptance across BG/EN, light/dark, both densities
  and narrow layouts, including delayed/live tables, maps, charts, account pages and notifications.
  Keep this review separate from automated checks; report any concrete defects in the existing
  [presentation backlog](admin-design-system.md).
- Select and configure a managed OSM-compatible raster tile provider and its required attribution
  before client demos. The runtime configuration is documented in
  [development](../development.md#ports-and-environment); the community OSM tiles remain the
  development/internal-demo default.

Other production/release prerequisites remain in the
[presentation and release backlog](admin-design-system.md#release-decisions).
Physical device verification, additional command families and recovery work remain in the
[ERM roadmap](erm-roadmap.md).
