# Proposed ADR: explicit Karma target and verified Fleet scope

Status: proposed; awaiting user confirmation with the [screen design](karma-device-management-design.md).
Move the accepted decision into the architecture decisions directory with the implementation.

## Problem

Karma exposes account-wide combined car/device records, while durable Fleet configuration
operations require a verified Tenant and Branch and a local Device. Moving their entry point
must not turn account visibility, registration text or similar-looking identifiers into authorization.

## Why the existing arrangement needs a change

The operation boundary already accepts an explicit per-request target and needs no synchronization.
Its Fleet-only route requires users to begin with a local Device instead of the upstream inventory.
The route and scope selection can change without changing durable storage or provider ownership.

## Decision

Reuse explicit per-request selection. The Karma car resource key, opaque upstream device ID,
local Device UUID and IMEI remain distinct. Select a verified Core Branch for the signed Tenant,
then a Device inside it; validate URL hints and recheck the car/device pair before submission.
Keep every Fleet query, mutation, history read and worker write Tenant/Branch scoped.

Add no persistent link, matching rule, reconciliation job or mapping table. Registration text and
the observed 15-digit device IDs cannot establish identity equality. Missing or changed targets
block actions; ambiguous candidates require an explicit choice. No duplicate link storage exists.

Capture the verified session, language, Branch, local Device and upstream pair for each operation.
Retire UI readers and late callbacks on context changes; accepted durable operations retain their
captured scope. Provider calls stay in Karma Client behind the existing machine-authenticated API;
Fleet retains the reusable operations, history and no-replay rule.

## Consequences

The user chooses Fleet context when entering from Karma. Old Fleet links can carry scope hints
but cannot select an upstream car automatically. No migration or automatic IMEI matching is needed.
A future persistent-link proposal requires verified upstream identity semantics, scoped uniqueness,
duplicate handling and separate architectural justification before implementation.

## Evidence

- [Current target and operation boundary](../discocan/architecture.md#background-device-configuration-reads).
- [Karma identity mapping](../discocan/erm-resources/karma-api-v2/data-models.md#cars-karmacar).
- Read-only configured-account inspection on 2026-10-21: 10 combined records, distinct car keys
  and nonempty device IDs; one detail matched its inventory row. No device commands were sent.
