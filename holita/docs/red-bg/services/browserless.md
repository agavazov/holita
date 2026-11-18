# browserless

Paths below are absolute. Status means source/documented status, not verified production use. Route numbers count literal declarations; resource macros count once and nested prefixes are included by their group; runtime-expanded routes may differ.

## Purpose and status

Sales workspace Chromium infrastructure used by Crawler and Sales; explicitly not an independent Git repository (`/workspace/projects/red.bg/workspace-sales/services/browserless/README.md`).

## Stack and runtime

Browserless Chromium, Xvfb, container and persistent downloads/metrics (`/workspace/projects/red.bg/workspace-sales/services/browserless/README.md`, `/workspace/projects/red.bg/workspace-sales/services/browserless/compose.yaml`). DB/cache/queue ownership not found.

## Data it owns

Runtime downloads and aggregate metrics; no schema or migrations found (`/workspace/projects/red.bg/workspace-sales/services/browserless/README.md`).

## Interfaces

Authenticated Browserless HTTP/WebSocket and DevTools; Sales discovers sessions (`/workspace/projects/red.bg/workspace-sales/services/browserless/README.md`). Endpoint counts not established.

## Screens

Debugger/live preview and Sales browser sessions (`/workspace/projects/red.bg/workspace-sales/services/browserless/README.md`).

## External integrations

Chromium/Browserless runtime (`/workspace/projects/red.bg/workspace-sales/services/browserless/README.md`).

## Dependencies on other services

Crawler and Sales connect to Browserless; edge exposes HTTP/WebSocket (`/workspace/projects/red.bg/workspace-sales/services/browserless/README.md`).

## Business rules worth keeping

Bounded concurrency, queue and browser-session duration (`/workspace/projects/red.bg/workspace-sales/services/browserless/README.md`).

## Size

6 parent-repository tracked files under `services/browserless` including example config and README (`git -C /workspace/projects/red.bg/workspace-sales ls-files services/browserless`). Tracked text: Markdown 2 files/97 lines, YAML 1/84, Shell 1/13, example config 1/26, other 1/1. Tests not found. Reimplementation: **S** — infrastructure wrapper, excluding Chromium itself.
