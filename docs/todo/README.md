# Project backlog

This directory holds pending work and planned tasks. It is separate from product
documentation and does not establish that a proposed feature is implemented.

## Where to record work

- Use [`_instant-tsks.md`](_instant-tsks.md) for short, one-line tasks.
- Use a descriptive Markdown file in this directory for larger plans or related tasks,
  grouped by component or topic.
- Link to an existing component backlog rather than copying its tasks.

Write entries in English. Describe the remaining work and link to relevant documentation
or source when context is needed. Keep proposals and unverified assumptions distinct from
implemented behavior. Product documentation remains under the relevant
[Discocan](../discocan/README.md), [Ecommerce](../ecommerce/README.md) or
[shared workspace](../README.md) directory.

## Keeping the backlog current

Add entries only for work that remains open. When work is complete, remove its entry and
update the authoritative documentation describing the resulting behavior. Report individual
check commands and results in the task response, following the [contributor rules](../../AGENTS.md).
Do not keep completed tasks, verification journals or session handoffs here.

Remove or replace cancelled or superseded tasks. When no short tasks remain, keep the
instant-task file with `No open instant tasks.`.

## Review corrections and Karma management

Track the confirmed review corrections, remaining Karma rule work and deferred cleanup in
[the review backlog](review-corrections-and-karma-management.md). It supersedes the temporary
review scratchpad; unverified candidates remain explicitly marked.

The [Karma settings backlog](karma-device-management-design.md) covers dated eData query latency,
live rule acceptance, rule/event allocation evidence and measured performance. Implemented contracts
remain in [Discocan architecture](../discocan/architecture.md#background-device-configuration-reads).

The [ERM functional verification plan](karma-api-v2.md#sequential-functional-verification-plan)
defines seven sequential stages for protocol access, reads, interval proof, DTC
configuration, fault formats and API agreement. Each stage has a maximum of 50
targeted attempts; stages 02–07 are authorized as one sequential run. Test Server/routing
work is excluded from that campaign.

## ERM device server and fleet control

The [production architecture plan](erm-server-production-architecture.md) turns the proof of concept
into the two-process NestJS service and organizes the parallel research sessions that precede the
interfaces.
The [fleet control plan](erm-fleet-control-plan.md) orders the tests that move every StarLink unit to
holita and prove its data, errors and commands, with safety rules, test levels and questions for ERM.
The [routing backlog](erm-tcp-receiver-and-test-device-routing.md) holds the receiver's engineering
tasks and the fleet's unit list.
The [control center interfaces](erm-control-center-interfaces.md) plan the operator pages on top of
holita's own server.

## Karma web functionality research

The [web functionality report](../discocan/erm-resources/karma-api-v2/web-functionality-research.md)
maps all 36 classic menu entries, safe action coverage and the accessible NC2
console to public/internal API methods, calculations and proposed holita views,
with bounded live observations and explicit source limitations. The
[Karma product and delivery backlog](karma-web-functional-discovery.md)
tracks the remaining source, retrieval and richer-map prerequisites for the
implemented operational and diagnostic workflows.
It tracks real public-API prerequisites without depending on ERM-only integrations.
It retains the remaining first-release tasks, dependencies, focused Karma navigation and
progressive disclosure, the mandatory clean-code/UX/visual-accessibility
consistency rules, Google Maps/Street View placements and gated
Trip Explorer/API-derived follow-ups. It also tracks unresolved provider/data prerequisites.
The navigation foundation is documented in [Discocan architecture](../discocan/architecture.md#karma-client);
the raw-unit report contract and field/state blueprint are documented there too.
Physical distance/speed-unit confirmation remains blocked for real-unit claims;
the map foundation and automatic active-map loading are implemented. Connected
overview and contextual map placements are implemented;
richer Maps JavaScript behavior, imagery and physical source-unit claims retain their explicit gates.
