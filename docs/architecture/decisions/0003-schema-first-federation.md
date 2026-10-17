# Local schema-first federation

Core and Fleet SDL define the API independently of Prisma persistence.
Local Apollo composition and GraphQL Codegen validate named operations and generate backend
and Angular types/documents, Gateway supergraph and public schema. This needs no database,
running service or external registry. Source contracts are tracked; generated output is ignored.

Each app generates only its own outputs. Shared Nx inputs include explicit SDL/operations and
tooling; Nest copies SDL into builds. Regenerate/restart after contract edits without dynamic
schema discovery or polling.

Gateway forwards request/Branch context. Fleet checks Core Branch existence only during
creation and reuses that promise within its HTTP request. Scoped reads/updates/deletes remain
independent of Core. Vehicle/Device.branch returns a federation reference resolved by Core.
Fleet availability guards include field/entity resolvers, preserving schema composition
while rejecting disabled business operations.
