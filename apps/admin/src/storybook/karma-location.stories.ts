import type { Meta, StoryObj } from '@storybook/angular-vite';
import { karmaRoute } from './karma-route';

const meta: Meta = {
  title: 'Admin/Karma Client/Trucks/Truck/Location',
  tags: ['!autodocs'],
};
export default meta;
export const Default: StoryObj = { render: karmaRoute('cars/41/location?listQ=TEST') };
export const Mobile: StoryObj = {
  ...Default,
  globals: { viewport: { value: 'mobile375', isRotated: false } },
};
