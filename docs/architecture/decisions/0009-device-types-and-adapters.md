# Device types and adapters

## Context

Discocan needs to support its own HTTP-connected hardware alongside StarLink units already in
service. Fleet's Device registry, admin and activity calculations need the same interface for
both. Live ERM units and the gateway, API and recovery processes that serve them must stay in
service without a redeploy for this change.

## Decision

Fleet resolves Devices in the caller's Tenant and Branch and selects a Fleet-side `DeviceAdapter`
by the registered type. `DISCOCAN` is the default. Its adapter calls the separate Device Server
over HTTP. [`@discocan/device-contract`](../../../discocan/packages/device-contract/src/index.ts)
defines the internal routes and payloads for reports, live state, inspection, commands,
configuration and notifications. Device Server implements that contract with empty reads and
unsupported writes.

The `ERM` adapter translates the existing `erm-api` GraphQL and internal HTTP responses. Fleet
owns the device-neutral GraphQL surface and scopes Device access before calling the adapter.
StarLink evidence is exposed under `erm`. Karma routing and return stay on the ERM subgraph.
The static supergraph marks the replaced ERM fields `@inaccessible` for external callers while
leaving them available to the adapter. The ERM runtime is unchanged.

## Consequences

Fleet forwards the caller's `authorization` and `x-branch-id` headers to `erm-api` for operator
GraphQL requests, so the existing ERM checks continue to apply. Existing internal ERM endpoints
retain their machine-token authentication. Device Server has its own loopback listener and
shared Fleet bearer token. See the [Discocan architecture](../../../discocan/docs/architecture.md#device-types-and-adapters).

The ERM translation could move into `erm-server` at a later ERM deployment if it can implement
the default device contract there. Fleet would continue selecting adapters by Device type.
