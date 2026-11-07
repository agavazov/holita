import type { Meta, StoryObj } from '@storybook/angular-vite';
import { defaultBranchId } from '../../../../storybook/session-fixtures';
import { routeAt, StoryApp, type StoryFixtures } from '../../../../storybook/story-config';
import { AdminWorkspace } from '../../../workspace/admin-workspace';
import { FleetWorkspace } from '../fleet-workspace';
import { GeneralSettingsPage } from './general-settings-page';
import { GeneralSettingsView, type GeneralSettings } from './general-settings-view';

const meta: Meta = {
  title: 'Admin/Settings/General',
  tags: ['!autodocs'],
  parameters: { holita: { signedIn: true } satisfies StoryFixtures },
};
export default meta;
type Story = StoryObj;
const path = `${defaultBranchId}/fleet/settings/general`;

function routed(): NonNullable<Story['render']> {
  const render = routeAt(path);
  return () => ({
    ...render(),
    moduleMetadata: { imports: [StoryApp, AdminWorkspace, FleetWorkspace, GeneralSettingsPage] },
    template: '<holita-story-app [url]="url" />',
  });
}

export const Default: Story = {
  render: routed(),
};

export const Loading: Story = {
  render: routed(),
  parameters: {
    holita: {
      scenario: { failures: { AdminFleetPreferences: 'pending' } },
    } satisfies StoryFixtures,
  },
};

export const ReadError: Story = {
  name: 'Preferences read failure',
  render: routed(),
  parameters: {
    holita: {
      scenario: { failures: { AdminFleetPreferences: 'network' } },
    } satisfies StoryFixtures,
  },
};

function preferences(dateFormat: GeneralSettings['dateFormat'], timeZone: string): Story {
  const settings: GeneralSettings = {
    name: 'Discordia',
    timeZone,
    dateFormat,
    distanceUnit: 'km',
    volumeUnit: 'l',
    lowFuelPct: 12,
    notReportingHours: 48,
    speedLimitKph: 90,
    notificationRetentionDays: 7,
  };
  return {
    render: () => ({
      props: { settings },
      moduleMetadata: { imports: [GeneralSettingsView] },
      template: '<holita-general-settings-view branchName="Discordia" [settings]="settings" />',
    }),
  };
}

export const IsoDate: Story = preferences('YYYY_MM_DD', 'Europe/Sofia');
export const DayFirstDashes: Story = preferences('DD_MM_YYYY', 'America/New_York');
export const DayFirstDots: Story = preferences('DD_DOT_MM_DOT_YYYY', 'Asia/Kathmandu');
