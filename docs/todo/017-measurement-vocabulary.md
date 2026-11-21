# 017 Measurement vocabulary for the hardware

**Status:** Blocked: needs real data from the hardware. **Product:** Discocan.

## Background

Fleet's measurements and rules use Simple eData catalog IDs for both device types, for example
warning lamps 1896, 1906 and 1910 and tachograph values 1435–1447. See
`discocan/packages/edata-rules` and Fleet's telemetry import. The hardware may report raw J1939 SPNs
or its own IDs.

## Goal

Decide whether the hardware's values map onto the eData IDs, or whether Fleet moves to a neutral
vocabulary such as J1939 SPNs.

## Steps

1. Collect at least a day of real data from the hardware on one truck.
2. Map each value to its eData catalog ID and its J1939 SPN.
3. Propose the smaller option to the owner, following the "Architectural changes" section of
   `AGENTS.md`.

## Done when

The owner has decided, and the decision is recorded in the architecture document or an ADR.
