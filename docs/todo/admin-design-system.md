# Admin design system

Pending work for a centrally controlled admin design that new modules reuse, reviewed in the
[admin Storybook](../development.md#admin-storybook) before it reaches application screens.
Work happens on the `feature/admin-design-system` branch.

## Decisions agreed with the user

- Keep PrimeNG 22 with its styled-mode tokens. The organisation qualifies for the PrimeUI
  Community license; Storybook runs without a key until a license is bought.
- The current admin presentation is not a reference. Design a new, better visual language from
  the actual data flows; Meridian (meridian.primeuipro.dev, a Nuxt/PrimeVue showcase) is visual
  inspiration only, never a source of code or assets.
- Keep light and dark themes and Bulgarian/English. Brand tokens (color, neutrals, density,
  font, shell geometry) are undecided and must stay easy to change centrally.
- Editing uses a drawer.
- Karma Client is temporary; do not redesign or build on it.
- Develop the Discocan Fleet domain into a rich demo and test bed with synthetic data,
  scenarios and new tables where useful. Backend list APIs may change, but must follow one
  standard contract (pagination, sorting, filtering, search) rather than serve one screen.
- The design system is shared by both domains' future admin screens.
- Approved screenshot baselines stay local and ignored; visual checks stay out of CI for now.

## Remaining phases

1. Direction: present two or three token and layout variants of a new shell, a Fleet list with
   filters and a drawer editor in Storybook; the user picks one.
2. Design system: one holita preset (`definePreset`) for brand, density and layout tokens; a
   small set of page patterns with measured reuse (page header, list toolbar and filters, state
   messages, form field, drawer editor); a design-system document and an agent skill with the
   central-change procedure.
3. Standard list contract and Fleet demo domain: define the shared GraphQL list conventions,
   extend Fleet SDL, Prisma models, migrations and synthetic seeds, and add fixtures and stories
   for every real state. Stop for visual approval of the new screens.
4. Rollout: replace the current Fleet screens with the approved patterns, update tests,
   smoke specs and the authoritative documentation, and remove superseded presentation rules.
5. Proof: apply one central token or pattern change and show its propagation in the visual
   review; build the next requested module from the skill alone.

## Open items

- Decide whether `@storybook/addon-vitest` should run stories (play functions, accessibility)
  in Vitest browser mode.
- Raise Storybook accessibility checks from `todo` to `error` once the new theme passes contrast;
  the current emerald primary with white text is below WCAG AA.
- The tracked `apps/admin/public/config.json` contains a PrimeUI license value; move it to an
  ignored local configuration and rotate it.
