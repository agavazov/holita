# Admin module passes

Storybook was removed on 2026-11-18. The development page `/:language/design` and
`npm run check:admin-styles` replace it. Pending:

- The owner reviews the Drivers pass. If approved, the design-system skill names Drivers as the
  reference for new screens.
- Then one module per task, the most local styling first: the live dashboard (455 style lines),
  the old dashboard, the control-center device page, Maintenance and Vehicles. Each pass keeps the
  behaviour, texts and GraphQL operations, reduces markup and styles to the shared patterns,
  removes duplicated helpers and dead code, and leaves desktop and 375 px captures before and
  after for the owner.
- Run `npm prune` when the live ERM units allow a `node_modules` change: the removed Storybook
  packages are still installed.
