# 013 Device Server: device-facing API

**Status:** Blocked: the hardware and its protocol have not arrived. **Product:** Discocan.

## Background

`discocan/apps/device-server` is a NestJS application on port 11019 that listens on loopback only.
It implements the internal contract `@discocan/device-contract` (routes in
`discocan/packages/device-contract/src/routes.ts`) with empty reads and unsupported writes. Fleet
calls it through `discocan/apps/fleet/src/integrations/discocan/` when `FLEET_DEVICE_SERVER_ENABLED`
is true, using `DEVICE_SERVER_URL` and the shared `DEVICE_SERVER_TOKEN` (see the root
`.env.example`). Nothing faces the devices yet.

## Goal

The hardware sends its reports to Device Server over HTTP.

## Steps

1. Get the protocol from the hardware documentation: payload format, how a device identifies itself,
   transport, retries and batching.
2. Design the device-facing API as a separate listener with TLS, apart from the internal loopback
   contract. Each device authenticates on its own (for example a per-device token or a client
   certificate), and the device maps to its Tenant and Branch through Fleet's Device registry.
3. Parse the reports into the contract's report types
   (`discocan/packages/device-contract/src/reports.ts`).
4. Follow the "Architectural changes" section of `AGENTS.md`. Write an ADR if the listener or the
   authentication design is a significant decision.
5. Add the new settings to the root `.env.example`, and update `discocan/docs/architecture.md` and
   `discocan/docs/development.md`.

## Done when

A real device's report reaches Device Server, and, together with ticket 014, Fleet's import shows
it.

## References

- [ADR 0009](../architecture/decisions/0009-device-types-and-adapters.md)
- [Device types and adapters](../../discocan/docs/architecture.md#device-types-and-adapters)
