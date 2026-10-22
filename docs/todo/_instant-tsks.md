# Instant tasks

## Admin defects

- The mobile navigation drawer's mask can stay on screen and block every click and body scroll.
  This happens when navigation closes the drawer and the viewport crosses 1024 px before the mask
  fade-out ends. PrimeNG `Drawer.onDestroy()` removes the mask only while the drawer is visible,
  and the shell's `@if (mobile())` destroys the closing drawer mid-animation.

## Storybook feedback

- Add a notifications page after real notification generation/delivery and account-backed
  feed/read-state contracts exist; do not fabricate a feed from Fleet counts. Provider work
  belongs to the [backend backlog](admin-design-system-backend.md#provider-integrations).
