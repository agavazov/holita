# 015 Commands to Discocan devices

**Status:** Blocked: needs the hardware's command set and ticket 014. **Product:** Discocan.

## Background

The contract defines command routes: create, list, get, cancel, retry, batches, fault reads,
parameter snapshots and configuration changes. Fleet's device-neutral actions are
`FleetDeviceAction` values (REQUEST_LOCATION, READ_STATUS, READ_VERSION, READ_ACCESSORIES,
READ_DIAGNOSTICS, READ_FAULTS, READ_PARAMETERS). Device Server answers "not supported" for every
command. For ERM Devices the admin prepares SMS texts, and `smsPassword` is a generic Device field.

## Goal

Fleet sends commands to the hardware over HTTP and gets results back. The admin can prepare the
hardware's SMS texts.

## Steps

1. From the protocol: does the device poll for commands with its reports, or can the server push?
2. Keep the command queue in Device Server's database (ticket 014) and serve the contract's command
   routes from it.
3. Map each `FleetDeviceAction` to the device's command. Report actions the device does not support
   as unsupported in the action catalog (`actionCatalog` route).
4. Add the hardware's SMS texts next to the ERM ones, keeping the device-neutral part outside
   `features/erm/`.

## Done when

The commands screen works for a hardware Device, including results.

## Limits

Configuration writes stay behind the existing write switch (`configurationWritesEnabled`) and roles.
