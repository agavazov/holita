import type { Meta, StoryObj } from '@storybook/angular-vite';
import { registerMonitoringFixtures } from '../../../../storybook/karma-monitoring-fixtures';
import { routeAt, StoryApp, type StoryFixtures } from '../../../../storybook/story-config';
import { MonitoringWorkspace } from './monitoring-workspace';

const meta: Meta = {
  title: 'Admin/Karma Client/Monitoring/Trucks',
  tags: ['!autodocs'],
  parameters: {
    holita: { signedIn: true, now: '2026-11-02T12:00:00.000Z' } satisfies StoryFixtures,
  },
  beforeEach: () => {
    registerMonitoringFixtures();
  },
};
export default meta;
type Story = StoryObj;
function routed(suffix = ''): NonNullable<Story['render']> {
  const render = routeAt('karma-client/monitoring/trucks' + suffix);
  return () => ({
    ...render(),
    moduleMetadata: { imports: [StoryApp, MonitoringWorkspace] },
    template: '<holita-story-app [url]="url" />',
  });
}
export const Default: Story = { render: routed() };
export const Loading: Story = {
  render: routed(),
  parameters: {
    holita: {
      scenario: { failures: { AdminKarmaMonitoringTrucks: 'pending' } },
    } satisfies StoryFixtures,
  },
};
export const ReadError: Story = {
  render: routed(),
  parameters: {
    holita: {
      scenario: { failures: { AdminKarmaMonitoringTrucks: 'network' } },
    } satisfies StoryFixtures,
  },
};
export const Disabled: Story = {
  render: routed(),
  beforeEach: () => {
    registerMonitoringFixtures('disabled');
  },
};
export const Empty: Story = {
  render: routed(),
  beforeEach: () => {
    registerMonitoringFixtures('empty');
  },
};
