import type { Meta, StoryObj } from '@storybook/angular-vite';
import { defaultBranchId } from '../../../../storybook/session-fixtures';
import { routeAt, StoryApp, type StoryFixtures } from '../../../../storybook/story-config';
import { AdminWorkspace } from '../../../workspace/admin-workspace';
import { FleetWorkspace } from '../fleet-workspace';
import { GeneralSettingsPage } from './general-settings-page';

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

export const ReadError: Story = {
  name: 'Preferences read failure',
  render: routed(),
  parameters: {
    holita: {
      scenario: { failures: { AdminFleetPreferences: 'network' } },
    } satisfies StoryFixtures,
  },
};
