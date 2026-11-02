import type { Meta, StoryObj } from '@storybook/angular-vite';
import { karmaRoute } from './karma-route';
import type { StoryFixtures } from './story-config';

const meta: Meta = {
  title: 'Admin/Karma Client/Trucks/Truck/Driving profile',
  tags: ['!autodocs'],
};
export default meta;
type Story = StoryObj;
const render = karmaRoute('cars/41/driving-profile');
export const Default: Story = { render };
export const Loading: Story = {
  render,
  parameters: {
    holita: {
      scenario: { failures: { AdminKarmaDrivingProfile: 'pending' } },
    } satisfies StoryFixtures,
  },
};
export const ErrorState: Story = {
  name: 'Error',
  render,
  parameters: {
    holita: {
      scenario: { failures: { AdminKarmaDrivingProfile: 'network' } },
    } satisfies StoryFixtures,
  },
};
export const Mobile: Story = {
  render,
  globals: { viewport: { value: 'mobile375', isRotated: false } },
};
