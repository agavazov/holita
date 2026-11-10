import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFAULT_EVENT_STRUCTURE } from '../../starlink/event.js';

// Both src/modules/devices and dist/modules/devices have the same repository depth.
const repositoryRoot = fileURLToPath(new URL('../../../../../', import.meta.url));

export function readPort(name: string, value: string): number {
  const port = Number(value);
  if (!/^\d+$/.test(value) || !Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`${name} must be an integer between 1 and 65535.`);
  }
  return port;
}

/** Units configured for primary mode in ERM_PRIMARY_UNITS. */
export function primaryUnitIds(): Set<string> {
  return new Set(
    (process.env.ERM_PRIMARY_UNITS ?? '')
      .split(',')
      .map((unit) => unit.trim().toUpperCase())
      .filter(Boolean),
  );
}

export function deviceConfig() {
  const upstream = process.env.ERM_UPSTREAM ?? 'in.karma.online:500';
  const separator = upstream.lastIndexOf(':');
  const upstreamHost = upstream.slice(0, separator);
  if (separator < 1 || upstreamHost === '') {
    throw new Error('ERM_UPSTREAM must be host:port.');
  }
  const upstreamPort = readPort('ERM_UPSTREAM port', upstream.slice(separator + 1));
  return {
    host: process.env.ERM_DEVICE_HOST ?? '0.0.0.0',
    port: readPort('ERM_DEVICE_PORT', process.env.ERM_DEVICE_PORT ?? '11500'),
    upstream,
    upstreamHost,
    upstreamPort,
    captureDirectory: resolve(
      repositoryRoot,
      process.env.ERM_CAPTURE_DIR ?? '.references/erm-server',
    ),
    primaryUnits: primaryUnitIds(),
    ackCommands: new Set(
      (process.env.ERM_ACK_COMMANDS ?? '06')
        .split(',')
        .map((command) => command.trim())
        .filter(Boolean),
    ),
    eventStructure: (process.env.ERM_EVENT_STRUCTURE ?? DEFAULT_EVENT_STRUCTURE)
      .split(',')
      .map((token) => token.trim()),
  };
}
