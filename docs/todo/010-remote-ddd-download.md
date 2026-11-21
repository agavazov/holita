# 010 Remote tachograph (.DDD) download

**Status:** Needs owner: choose the approach. **Product:** Discocan.

## Background

Research on 2026-11-19:

- Simple eData cannot download .DDD files remotely. It listens on a fixed CAN and cannot pass the
  company card authentication through.
- ERM's public site lists no remote-download product. Questions for ERM were drafted but not sent:
  remote .DDD with StarLink or eData Pro, supported tachographs, a company-card server, the protocol,
  the CAN address and the cost.
- The other option is a separate remote-download unit on the tachograph's CAN C, next to the eData.
  Examples are Teltonika FMC650 with TachoSync, VDO Link and Ruptela HCV5. flespi Tacho Bridge could
  serve our own server. It would be piloted on one truck.
- Until then, downloads are manual, with VDO DLK Pro S or Stoneridge digivu and the company card:
  the vehicle unit every 90 days and driver cards every 28 days.

## Goal

The owner chooses between asking ERM, piloting a separate unit, or staying with manual downloads.

## Steps

1. Put the three options to the owner in a few lines each.
2. If ERM: draft the email in the owner's style. The owner sends it.
3. If a pilot: compare two or three units on price, supported tachographs, company-card handling
   and how the files reach our server. Propose one truck for the pilot.

## Done when

The owner has chosen and the next concrete step (email draft or pilot proposal) is ready.

## Limits

Nothing goes to ERM or a vendor without the owner's explicit yes. Keep truck and customer
identifiers out of external searches.
