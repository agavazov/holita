import type { Meta, StoryObj } from '@storybook/angular-vite';
import { routeAt, StoryApp, type StoryFixtures } from '../../../../storybook/story-config';
import { AdminWorkspace } from '../../../workspace/admin-workspace';
import { KarmaWorkspace } from '../karma-workspace';

const meta: Meta = {
  title: 'Admin/Karma Client/Trucks/Truck/Record details',
  tags: ['!autodocs'],
  parameters: { holita: { signedIn: true } satisfies StoryFixtures },
};
export default meta;
type Story = StoryObj;

function routed(section: string): NonNullable<Story['render']> {
  return () => ({
    ...routeAt(`karma-client/cars/41${section}`)(),
    moduleMetadata: { imports: [StoryApp, AdminWorkspace, KarmaWorkspace] },
    template: '<holita-story-app [url]="url" />',
  });
}

export const Edata: Story = {
  name: 'eData message — open View message',
  render: routed('/edata'),
};

export const Events: Story = {
  name: 'Event — open View',
  render: routed('/events'),
};

export const MobileMessage: Story = {
  ...Edata,
  globals: { viewport: { value: 'mobile375', isRotated: false } },
};
