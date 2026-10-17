# ERM eData parameter configuration interface

## Objective

Provide a way to select reporting parameters and change their reporting intervals
for a specific truck, with a clear account of what the device has actually stored
and whether new measurements are arriving. This is pending product work; a command
interface is not currently implemented in holita.

The authoritative technical context is
[Configuring eData parameter reporting through Karma](../discocan/erm-resources/edata-simple-protocol-v4.04/parameter-reporting.md).
It explains the catalog/configuration/measurement distinction, command and response
flow, preservation of existing settings, verification, missing-data cases and
restoration. Keep command layouts and operational instructions there instead of
duplicating them in this task.

## Relationship to the catalog work

Parameter extraction and database storage are implemented separately in the
[shared versioned catalog](../discocan/erm-resources/simple-edata-catalog/README.md).
Inspect its file contract and Fleet persistence before choosing how the interface
consumes it. This task does not specify another importer or persistence model.

A catalog supplies selectable metadata and provenance, not a guarantee that a
particular vehicle supports every entry. The interface will also need the selected
device's current configuration and actual reporting evidence. Those facts must
remain distinguishable even when catalog data is already stored locally.

## Context for the design

The known manual process can add individual parameters without replacing the
working configuration. Fuel rate, engine load and accelerator position have produced
fresh measurements through that process. The evidence is limited to the documented
installation/profile; presenting the whole catalog as universally supported would
overstate what is known.

Configuration is asynchronous. API acceptance, queue transmission, device readback
and measurement verification can happen at different times. A useful experience
would explain the current evidence and what remains unknown, rather than reducing
all outcomes to a successful or failed submission. A parked or sleeping truck may
leave verification pending without proving that the change failed.

An operator should be able to understand the intended change and its target,
preserve unrelated settings, and find the relevant previous configuration if
restoration is needed. Changes by another operator, a switch to another truck,
partial responses or an uncertain submission must not make stale evidence look
current or cause an unexamined duplicate write.

The present shared-account read access does not establish who should be allowed
to configure devices. Decide the write-access and accountability needs explicitly;
do not infer them from vehicle visibility. Keep authentication material out of the
user-facing flow and stored change evidence.

## Expected outcome

- The selected truck/device, catalog provenance, current configuration and intended
  parameter changes are understandable before submission.
- Existing reporting survives additions and interval changes, including parameters
  that are unknown to the local catalog.
- Submitted changes can be checked against device readback and fresh telemetry;
  waiting, missing data and uncertain outcomes remain visible without false success.
- Relevant before/after evidence supports an informed restoration decision, without
  treating measurement history as a configuration backup.
- Catalog extraction/storage and this interface remain separate responsibilities,
  connected through whatever verified implementation is available at development time.

Screen layout, components, application contracts and database design are deliberately
left to the implementation work. Use the repository's current domain instructions
and architecture when making those choices. General provider questions about queue
states, acknowledgments, retry semantics and permissions remain in the
[Karma API backlog](karma-api-v2.md#uncovered-resources-and-fields).
