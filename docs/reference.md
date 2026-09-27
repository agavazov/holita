# Reference implementation index

Reference is the working Event Management example in holita. Open the admin, select a
store and choose **Reference → Events**. It uses the same gateway and store context as
Products, with its own service and database. See [usage and configuration](development.md#using-reference)
and [application boundaries](architecture/overview.md) for the implemented behavior.

Start with the smallest example that fits the feature. Products and Venues show ordinary
CRUD; Events add relationships, a program, content and lifecycle operations. A new feature
does not need every Event capability. These are concrete implementations, not a CRUD
framework or a separate mock application.

## Start with one vertical slice

Follow **Venues** from the admin to persistence:

1. [List](../apps/admin/src/features/reference/venues/venue-list.tsx),
   [editor](../apps/admin/src/features/reference/venues/venue-editor.tsx) and
   [form](../apps/admin/src/features/reference/venues/venue-form.tsx) use Refine and Ant Design.
2. [Named operations](../apps/admin/src/features/reference/venues/operations.graphql) and
   [provider mapping](../apps/admin/src/data/venues-provider.ts) use generated contracts.
   The [single data provider](../apps/admin/src/data/data-provider.ts) captures request scope.
3. [Gateway configuration](../apps/gateway/src/graphql/gateway.config.ts) forwards context
   through the composed schema; it does not import Reference persistence.
4. [SDL](../apps/reference/src/venues/venues.graphql),
   [resolver](../apps/reference/src/venues/venues.resolver.ts),
   [service](../apps/reference/src/venues/venues.service.ts) and
   [repository](../apps/reference/src/venues/venues.repository.ts) separate the API,
   validation and store-scoped Prisma access.
5. [Prisma schema](../apps/reference/prisma/schema.prisma) and
   [migrations](../apps/reference/prisma/migrations) belong to Reference.
   [Seeds](../apps/reference/prisma/seed.ts) insert missing examples without updating existing records.
6. [Service tests](../apps/reference/src/venues/venues.service.spec.ts),
   [database tests](../apps/reference/test/venues.db.spec.ts),
   [admin tests](../apps/admin/src/features/reference/reference-workspace.test.tsx) and
   [browser checks](../tools/browser/reference.smoke.spec.mts) exercise the slice at its boundaries.

## Find a richer example

| Need                                                                      | Implementation                                                                                                                                                                                                                                                                                                         | Behavioral checks                                                                                                                                                                                                                |
| ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Store and route isolation, pending writes, dirty navigation               | [Store workspace](../apps/admin/src/features/stores/store-workspace.tsx), [Reference routes](../apps/admin/src/features/reference/reference-workspace.tsx), [unsaved changes](../apps/admin/src/features/reference/use-unsaved-changes.tsx)                                                                            | [Store lifecycle](../apps/admin/src/features/stores/store-workspace.test.tsx), [mobile navigation](../tools/browser/reference-layout.smoke.spec.mts)                                                                             |
| Sectioned forms, money, dates, conditional fields and field errors        | [Event form](../apps/admin/src/features/reference/events/event-form.tsx), [editor](../apps/admin/src/features/reference/events/event-editor.tsx), [Sofia time conversion](../apps/admin/src/features/reference/events/event-time.ts), [service validation](../apps/reference/src/events/events.service.ts)             | [Event admin](../apps/admin/src/features/reference/events/event-workspace.test.tsx), [Event persistence](../apps/reference/test/events.db.spec.ts), [time cases](../apps/admin/src/features/reference/events/event-time.test.ts) |
| Remote single/multiple relations without preloading tables                | [Relation select](../apps/admin/src/features/reference/relation-select.tsx), [Event repository](../apps/reference/src/events/events.repository.ts), [Speaker assignments](../apps/admin/src/features/reference/sessions/event-speakers.tsx)                                                                            | [Event browser flow](../tools/browser/events.smoke.spec.mts), [Session persistence](../apps/reference/test/sessions.db.spec.ts)                                                                                                  |
| URL filters, pagination, sorting, column preferences and overview actions | [Event list](../apps/admin/src/features/reference/events/event-list.tsx), [list state](../apps/admin/src/features/reference/events/event-list-state.ts), [overview](../apps/admin/src/features/reference/events/event-show.tsx)                                                                                        | [List/overview cases](../apps/admin/src/features/reference/events/event-list.test.tsx), [browser checks](../tools/browser/events.smoke.spec.mts)                                                                                 |
| Child CRUD and explicit ordering                                          | [Session list](../apps/admin/src/features/reference/sessions/session-list.tsx), [order draft](../apps/admin/src/features/reference/sessions/use-session-order.ts), [Session service](../apps/reference/src/sessions/sessions.service.ts)                                                                               | [Session browser flow](../tools/browser/sessions.smoke.spec.mts)                                                                                                                                                                 |
| Rich text with a bounded, sanitized HTML contract                         | [Description editor](../apps/admin/src/features/reference/events/description-editor.tsx), [backend sanitizer](../apps/reference/src/events/description-html.ts)                                                                                                                                                        | [Sanitizer tests](../apps/reference/src/events/description-html.spec.ts), [rich text browser flow](../tools/browser/rich-text.smoke.spec.mts)                                                                                    |
| Gallery, direct upload, preview, alt text and cover                       | [Gallery](../apps/admin/src/features/reference/media/event-gallery.tsx), [upload hooks](../apps/admin/src/features/reference/media/use-media-actions.ts), [HTTP transport](../apps/admin/src/data/direct-upload.ts), [Media service](../apps/reference/src/media/media.service.ts)                                     | [Gallery admin](../apps/admin/src/features/reference/media/event-gallery.test.tsx), [Media persistence](../apps/reference/test/media.db.spec.ts), [browser flow](../tools/browser/media.smoke.spec.mts)                          |
| Atomic bulk actions, Trash/restore and transactional history              | [Bulk actions](../apps/admin/src/features/reference/events/event-bulk-actions.tsx), [history UI](../apps/admin/src/features/reference/events/event-history.tsx), [Event repository](../apps/reference/src/events/events.repository.ts), [history repository](../apps/reference/src/events/event-history.repository.ts) | [Lifecycle persistence](../apps/reference/test/lifecycle.db.spec.ts), [admin cases](../apps/admin/src/features/reference/events/event-lifecycle.test.tsx), [browser flow](../tools/browser/lifecycle.smoke.spec.mts)             |
| Disabled mode with retained data and continued Products access            | [Backend guard](../apps/reference/src/reference-enabled.guard.ts), [admin route boundary](../apps/admin/src/features/stores/store-workspace.tsx)                                                                                                                                                                       | [Federation checks](../tools/graphql/federation.db.spec.mts), [disabled browser flow](../tools/browser/reference-disabled.smoke.spec.mts)                                                                                        |

## Boundaries to preserve

Store context scopes data; it is not authentication. The [core client](../apps/reference/src/core/core.client.ts)
checks store existence at creation. Repositories require the active store for reads and
writes. Admin mutations capture the scoped resource when submitted; route/store changes
unmount editors, while Refine invalidates the original resource. History attributes changes
to Anonymous because authenticated identity is not implemented.

Uploads use GraphQL intent → direct HTTP transfer → GraphQL finalization. Binary files
never pass through the gateway. The [storage contract](../apps/reference/src/media/media-storage.ts),
[local implementation](../apps/reference/src/media/local-media-storage.ts),
[HTTP controller](../apps/reference/src/media/media.controller.ts) and
[cleanup](../apps/reference/src/media/media.cleanup.ts) implement private local storage,
short-lived upload/read URLs and orphan cleanup. Only local storage is implemented;
there is no AWS dependency or object-storage adapter. See [media configuration and limits](development.md#using-reference).

Keep schema and operations as generator inputs; do not copy generated clients or import
another application's implementation. Follow the [backend](../.agents/skills/holita-backend-feature/SKILL.md)
and [admin](../.agents/skills/holita-admin-feature/SKILL.md) procedures for changes, and use
the [focused check mapping](testing.md#reference-checks) to select actual test files.
Database and browser fixtures own isolated schemas and processes; normal development data
is not a test fixture.
