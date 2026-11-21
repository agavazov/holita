# 016 Hardware model and parameters

**Status:** Blocked: needs the hardware documentation. **Product:** Discocan.

## Background

`FleetDeviceModel` in `discocan/apps/fleet/prisma/schema.prisma` has `STARLINK_TRACKER`,
`STARLINK_SCOUT` and `OTHER`. The contract has routes for the parameter catalog and for measurement
configuration (`parameterCatalog`, `startMeasurementConfigurationChange` and the other
configuration routes). Device Server answers them with empty data.

## Goal

The Device form offers the hardware's model. Device Server serves its parameter catalog and
measurement configuration.

## Steps

1. Add the model value to the Prisma enum with `@map`, in a reviewed migration. Update the SDL, run
   codegen and `schema:check`, and add the option with Bulgarian and English texts in the admin.
2. Build the parameter catalog from the vendor documentation and serve it from Device Server.
3. Implement measurement configuration through the configuration routes, behind the existing write
   switch.

## Done when

A hardware Device can be registered with its model, and its parameter catalog shows in the admin.
