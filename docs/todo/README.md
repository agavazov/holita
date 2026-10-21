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

Track the confirmed review corrections, pending Karma design and deferred cleanup in
[the review backlog](review-corrections-and-karma-management.md). It supersedes the temporary
review scratchpad; unverified candidates remain explicitly marked.
