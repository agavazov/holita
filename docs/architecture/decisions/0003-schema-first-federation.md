# Local schema-first federation

SDL defines the API independently of persistence. Core, products and reference own their contracts;
Prisma owns their database models. Local Node tooling uses Apollo composition and GraphQL
Codegen to validate operations and generate backend/client types, typed documents, the
supergraph and public schema. No running services, database, registry or router binary is
needed for this work. Source SDL and operations are tracked; generated output is ignored.

Each app's generation target writes only its own files. Explicit Nx inputs include shared
contracts/tooling, preventing stale cache restoration after generator or schema changes.
Nest copies SDL assets into builds. Regenerate and restart after contract edits; there is
no dynamic discovery or schema polling.

Gateway forwards request/store context. Products validates store existence through core
only for creation and reuses that result within the products request. Read/update/delete
remain independent of core for product-only selections. Product.store returns a federation
reference; core resolves it from its database. This preserves service ownership without
adding synchronous store checks to every operation, events or a replicated store registry.

Reference follows the same creation-time check and Store federation contract.
The Reference availability guard also runs on field/reference resolvers; disabling the
service preserves schema composition while rejecting its business operations.
