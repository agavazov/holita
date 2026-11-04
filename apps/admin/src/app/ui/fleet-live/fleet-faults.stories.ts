import type { Meta, StoryObj } from '@storybook/angular-vite';
import { fixtureLiveDevice } from '../../../storybook/devices-fixtures';
import { onFrame } from '../../../storybook/story-config';
import { FleetFaults } from './fleet-faults';
const meta: Meta<FleetFaults> = {
  title: 'Design System/Fleet/Faults',
  component: FleetFaults,
  decorators: [onFrame],
  tags: ['!autodocs'],
};
export default meta;
type Story = StoryObj<FleetFaults>;
export const DiagnosticReports: Story = {
  args: {
    device: {
      ...fixtureLiveDevice,
      ermState: fixtureLiveDevice.ermState
        ? {
            ...fixtureLiveDevice.ermState,
            alarmsLast24h: 265,
            latestAlarm: {
              ...fixtureLiveDevice.ermState.latestAlarm,
              eventTime: '2026-10-20T07:30:00.000Z',
              severity: 'WARNING',
              nameEn: 'Diagnostic report',
              nameBg: 'Диагностичен отчет',
            },
          }
        : null,
    },
    link: ['/control-center/devices', fixtureLiveDevice.imei],
  },
};
export const CriticalAlarm: Story = {
  args: {
    device: {
      ...fixtureLiveDevice,
      ermState: fixtureLiveDevice.ermState
        ? {
            ...fixtureLiveDevice.ermState,
            latestAlarm: {
              ...fixtureLiveDevice.ermState.latestAlarm,
              eventTime: '2026-10-20T07:30:00.000Z',
              severity: 'CRITICAL',
              nameEn: 'Low oil pressure',
              nameBg: 'Ниско налягане на маслото',
            },
          }
        : null,
    },
  },
};
export const NoFaults: Story = {
  args: {
    device: {
      ...fixtureLiveDevice,
      ermState: fixtureLiveDevice.ermState
        ? { ...fixtureLiveDevice.ermState, alarmsLast24h: 0, latestAlarm: null }
        : null,
    },
    link: ['/control-center/devices', fixtureLiveDevice.imei],
  },
};
export const Empty: Story = { args: { device: null } };
export const RecordedCanFault: Story = {
  args: {
    device: {
      ...fixtureLiveDevice,
      ermState: fixtureLiveDevice.ermState
        ? { ...fixtureLiveDevice.ermState, alarmsLast24h: 0, latestAlarm: null }
        : null,
      diagnostics: {
        count: 1,
        latest: {
          kind: 'CAN_ERROR',
          occurredAt: '2026-10-20T07:00:00.000Z',
          troubleCode: 'U0100',
          details: 'CAN communication error',
          source: 'ERM',
        },
      },
    },
  },
};
