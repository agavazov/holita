import type { Meta, StoryObj } from '@storybook/angular-vite';
import { karmaRoute } from './karma-route';

const meta: Meta = {
  title: 'Admin/Karma Client/Administration/Projects',
  tags: ['!autodocs'],
};
export default meta;
export const Default: StoryObj = { render: karmaRoute('administration/projects') };
