# 019 ERM adapter inside erm-server

**Status:** Blocked: only at the next ERM deployment, and only if the owner wants it. **Product:**
Discocan.

## Background

Fleet's ERM adapter (`discocan/apps/fleet/src/integrations/erm/`) translates the existing erm-api
GraphQL and internal HTTP responses into the device contract. ADR 0009 notes that this translation
could move into `erm-server` if `erm-server` implements the default device contract. Fleet would then
call both device types through the same contract client. The live ERM units run from the deployed
copies `apps/erm-server/live/` and `live-api/` and are deployed only with the owner.

## Goal

At the next ERM deployment, the owner decides whether to move the translation.

## Steps

1. Estimate the change: which contract routes `erm-server` would serve, and what Fleet's ERM adapter
   would lose.
2. Ask the owner, with the estimate.
3. If yes: implement the contract in `erm-server`, switch Fleet to the contract client for ERM
   Devices, and deploy as described in
   [service management](../../discocan/docs/development.md#development-and-service-management),
   together with the owner.

## Done when

The owner has decided, and the move is done or the ticket is closed.

## References

- [ADR 0009](../architecture/decisions/0009-device-types-and-adapters.md)
