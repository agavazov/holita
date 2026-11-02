import type { Meta, StoryObj } from '@storybook/angular-vite';
import { karmaRoute } from './karma-route';

const meta: Meta = {
  title: 'Admin/Karma Client/Trucks/Truck/Trips',
  tags: ['!autodocs'],
};
export default meta;
export const Default: StoryObj = { render: karmaRoute('cars/41/trips?listQ=TEST') };
export const Mobile: StoryObj = {
  ...Default,
  globals: { viewport: { value: 'mobile375', isRotated: false } },
};
