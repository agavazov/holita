# Instant tasks

## High priority

- Use camelCase for every database identifier in all services (owner, 2026-11-02). Columns are
  already camelCase; tables and enum types use PascalCase model names, and enum values use
  UPPER_SNAKE. Map them with Prisma `@@map`/`@map`, keep the TypeScript and GraphQL names and the
  `holita_*` database names, and update the raw SQL. The owner allows discarding the current test
  data and migration history because the software is not live yet.

## Storybook feedback

- Add a notifications page after real notification generation/delivery and account-backed
  feed/read-state contracts exist; do not fabricate a feed from Fleet counts. Provider work
  belongs to the [backend backlog](admin-design-system-backend.md#provider-integrations).
