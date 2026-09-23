# npm workspaces with Nx tasks

## Context

The repository already has a useful npm workspace, lockfile, Vite/Nest scripts and strict
root tooling. Workspace scripts alone do not enforce application import boundaries or
describe project impact for selected validation.

## Decision

Retain npm and the native application scripts. Add Nx with application project metadata,
task inputs/caching, affected commands and ESLint module boundaries. Keep concurrently for
the existing host process workflow. Nx Cloud is disabled and no account is required.
The optional Nx daemon is disabled after connection resets in the WSL execution environment;
commands calculate the project graph without that background service.

## Consequences

Developers use root npm commands and can still invoke application workspace scripts.
Applications cannot import each other's implementation. Shared configuration is an input
to affected validation. Nx does not infer behavioral test coverage from project selection;
the testing guide remains necessary. No new runtime workspace package is introduced.
