# Historical Fleet integration through Karma

Deprecated reference only; retained for comparison while discocan replaces Karma.

## Background device configuration reads

The [device operations SDL](../../../apps/fleet/src/modules/device-operations/device-operations.graphql),
[service](../../../apps/fleet/src/modules/device-operations/device-operations.service.ts),
[repository](../../../apps/fleet/src/modules/device-operations/device-operations.repository.ts) and
[processor](../../../apps/fleet/src/modules/device-operations/device-operations.processor.ts)
own durable eData reads, predefined-parameter additions and existing-interval changes. The
[Karma internal client](../../../apps/fleet/src/integrations/karma/karma-device-reads.client.ts)
uses fixed machine-authenticated HTTP endpoints without cross-application imports.

The admin's [configuration page](../../../apps/admin/src/app/features/fleet/device-operations/device-configuration-page.ts)
is reached from a Device's Diagnostics. It preserves the last complete snapshot while an
operation is pending and reloads persisted work after navigation or refresh. Its
[parameter editor](../../../apps/admin/src/app/features/fleet/device-operations/device-parameter-editor.ts)
previews one confirmed change against a complete baseline. The
[definition helpers](../../../apps/fleet/src/modules/device-operations/device-parameter-change.ts)
preserve unknown raw fields, construct verified Monitor presets and compare the complete
result; [profile evidence](../../../apps/fleet/src/modules/device-operations/device-profile-evidence.ts)
has its own age and watermark. See the
[architecture](architecture.md#background-device-configuration-reads),
[setup and workflow](development.md#background-device-configuration-reads) and
[testing](../../testing.md).
