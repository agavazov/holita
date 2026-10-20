# Admin design system: remaining decisions

Pending product and release choices only. The [main backlog](admin-design-system.md) indexes
remaining frontend/backend work; current implementation belongs to the
[design-system document](../admin-design-system.md) and
[Fleet implementation index](../discocan/fleet.md).

## Decisions needed from the user

### Story tests as a PR gate

PR CI (`.github/workflows/affected.yml`) runs affected native checks and, for an affected admin,
Chromium smokes; it does not build Storybook or run `test:storybook:admin`.
Story interaction/axe tests are distinct from the visual checks that the user currently keeps
outside CI. See [GitHub Actions](../testing.md#github-actions).

Decide whether affected-admin PR CI should run the story tests or whether they remain in local
and manually requested full regression. Recommended: add them to affected-admin PR CI after
the Chromium installation, update the authoritative testing guidance and validate the workflow
with `actionlint`.

### PrimeUI key rotation

An earlier commit stored a key in `apps/admin/public/config.json`. The tracked file no longer
holds it, but the old value remains in Git history. Build exclusions protect the current local
developer key; they do not rotate the historical key.

The user must rotate that key through the license provider. Remove this entry after rotation;
retain the separate [production-license task](admin-design-system.md#release-decisions) until
public-release configuration is ready.
