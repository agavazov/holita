# telephony-gw

Paths below are absolute. Status means source/documented status, not verified production use. Route numbers count literal declarations; resource macros count once and nested prefixes are included by their group; runtime-expanded routes may differ.

## Purpose and status

Hardware-bound Asterisk/GSM gateway; this Sales checkout is reference-only and outside its managed runtime (`/workspace/projects/red.bg/workspace-sales/services/telephony/gw/README.md`).

## Stack and runtime

Asterisk 20.6, Huawei E173/chan_dongle, WireGuard, Node agent, host networking (`/workspace/projects/red.bg/workspace-sales/services/telephony/gw/README.md`). DB/queue not found; local Asterisk state/logs.

## Data it owns

No migrations found; operational local Asterisk state/logs, no central recordings (`/workspace/projects/red.bg/workspace-sales/services/telephony/gw/README.md`).

## Interfaces

SIP/RTP, loopback ARI, authenticated gateway agent for status/operations, WireGuard; route counts not established (`/workspace/projects/red.bg/workspace-sales/services/telephony/gw/docs/architecture.md`).

## Screens

Gateway Agent status/operations UI (`/workspace/projects/red.bg/workspace-sales/services/telephony/gw/agent/ui.mjs`).

## External integrations

Huawei USB GSM modems, Asterisk, WireGuard (`/workspace/projects/red.bg/workspace-sales/services/telephony/gw/README.md`).

## Dependencies on other services

Telephony API connects to gateway and polls agent; recording authority stays central (`/workspace/projects/red.bg/workspace-sales/services/telephony/gw/README.md`).

## Business rules worth keeping

Logical lines map to modem identities rather than volatile USB device names; this checkout does not establish current hardware usage (`/workspace/projects/red.bg/workspace-sales/services/telephony/gw/README.md`).

## Size

75 tracked files; included 61 excluded {'restricted': 14} tests 8 migrations 0 commits 38; Markdown: 8 files/1570 lines, JavaScript: 13 files/1520 lines, Shell: 14 files/1417 lines, Other: 25 files/492 lines, YAML: 1 files/168 lines. Test-directory file counts (including fixtures/helpers): {'agent/tests': 5, 'tests/agent-action.test.sh': 1, 'tests/contract.sh': 1, 'tests/wireguard-entrypoint.test.sh': 1}. Source: `/workspace/projects/red.bg/workspace-sales/services/telephony/gw` (`git ls-files`). Reimplementation: **M** — hardware operational boundary despite small source tree.
