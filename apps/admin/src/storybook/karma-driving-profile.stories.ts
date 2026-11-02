import type { Meta, StoryObj } from '@storybook/angular-vite';
import { karmaRoute } from './karma-route';

const meta: Meta = {
  title: 'Admin/Karma Client/Trucks/Truck/Driving profile',
  tags: ['!autodocs'],
};
export default meta;
export const Default: StoryObj = { render: karmaRoute('cars/41/driving-profile') };
export const Mobile: StoryObj = {
  ...Default,
  globals: { viewport: { value: 'mobile375', isRotated: false } },
};
