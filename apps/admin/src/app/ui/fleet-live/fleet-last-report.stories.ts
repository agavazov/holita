import type { Meta, StoryObj } from '@storybook/angular-vite';
import { fixtureLiveDevice } from '../../../storybook/devices-fixtures';
import { onFrame, type StoryFixtures } from '../../../storybook/story-config';
import { FleetLastReport } from './fleet-last-report';
const meta: Meta<FleetLastReport> = {
  title: 'Design System/Fleet/Last report',
  component: FleetLastReport,
  decorators: [onFrame],
  parameters: { discocan: { now: '2026-10-20T08:00:05.000Z' } satisfies StoryFixtures },
  tags: ['!autodocs'],
};
export default meta;
type Story = StoryObj<FleetLastReport>;
export const Reported: Story = { args: { device: fixtureLiveDevice } };
export const Empty: Story = { args: { device: null } };
