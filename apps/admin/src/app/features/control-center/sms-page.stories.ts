import type { Meta, StoryObj } from '@storybook/angular-vite';
import '../../../storybook/control-center-fixtures';
import { defaultBranchId } from '../../../storybook/session-fixtures';
import { routeAt, StoryApp, type StoryFixtures } from '../../../storybook/story-config';
import { AdminWorkspace } from '../../workspace/admin-workspace';
import { ControlCenterWorkspace } from './control-center-workspace';
import { SmsPage } from './sms-page';

const meta: Meta = {
  title: 'Admin/Control center/SMS commands',
  tags: ['!autodocs'],
  parameters: { holita: { signedIn: true } satisfies StoryFixtures },
};
export default meta;
type Story = StoryObj;
function routed(): NonNullable<Story['render']> {
  const render = routeAt(defaultBranchId + '/control-center/sms');
  return () => ({
    ...render(),
    moduleMetadata: { imports: [StoryApp, AdminWorkspace, ControlCenterWorkspace, SmsPage] },
    template: '<holita-story-app [url]="url" />',
  });
}
export const Default: Story = {
  render: routed(),
};
export const ErrorState: Story = {
  name: 'Error',
  parameters: {
    holita: {
      scenario: { failures: { AdminControlCenterSmsDevices: 'network' } },
    } satisfies StoryFixtures,
  },
  render: routed(),
};
