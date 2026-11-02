import type { Meta, StoryObj } from '@storybook/angular-vite';
import { StoryApp, type StoryFixtures } from '../../../../storybook/story-config';
import { AdminWorkspace } from '../../../workspace/admin-workspace';
import { KarmaWorkspace } from '../karma-workspace';

const meta: Meta = {
  title: 'Admin/Karma Client/Truck workspace',
  tags: ['!autodocs'],
  parameters: { holita: { signedIn: true } satisfies StoryFixtures },
};
export default meta;
type Story = StoryObj;

function routed(path: string, language = 'en'): NonNullable<Story['render']> {
  return () => ({
    props: { url: `/${language}/karma-client/cars/41${path}` },
    moduleMetadata: { imports: [StoryApp, AdminWorkspace, KarmaWorkspace] },
    template: '<holita-story-app [url]="url" />',
  });
}

export const Overview: Story = {
  render: routed('?listQ=TEST&listSize=25&listFirst=25&listProject=12'),
};
export const Trips: Story = { render: routed('/trips?listQ=TEST') };
export const Location: Story = { render: routed('/location?listQ=TEST') };
export const Events: Story = { render: routed('/events?listQ=TEST') };
export const Edata: Story = { render: routed('/edata?listQ=TEST') };
export const DrivingProfile: Story = { render: routed('/driving-profile?listQ=TEST') };
export const DeviceSettings: Story = {
  render: routed('/configuration?listQ=TEST'),
  parameters: { holita: { fleetEnabled: false } satisfies StoryFixtures },
};
export const Bulgarian: Story = { render: routed('/events?listQ=TEST', 'bg') };
export const Mobile: Story = {
  render: routed('/location?listQ=TEST'),
  globals: { viewport: { value: 'mobile375', isRotated: false } },
};
export const MobileMore: Story = {
  render: routed('/configuration?listQ=TEST', 'bg'),
  globals: { viewport: { value: 'mobile375', isRotated: false } },
  parameters: { holita: { fleetEnabled: false } satisfies StoryFixtures },
};
export const Dark: Story = {
  render: routed('/events?listQ=TEST'),
  globals: { theme: 'dark' },
};
export const Loading: Story = {
  render: routed(''),
  parameters: {
    holita: { scenario: { failures: { AdminKarmaCar: 'pending' } } } satisfies StoryFixtures,
  },
};
export const ErrorState: Story = {
  name: 'Error',
  render: routed(''),
  parameters: {
    holita: { scenario: { failures: { AdminKarmaCar: 'network' } } } satisfies StoryFixtures,
  },
};
