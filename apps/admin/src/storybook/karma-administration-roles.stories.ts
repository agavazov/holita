import type { Meta, StoryObj } from '@storybook/angular-vite';
import { karmaRoute } from './karma-route';
import type { StoryFixtures } from './story-config';

const meta: Meta = { title: 'Admin/Karma Client/Administration/Roles', tags: ['!autodocs'] };
export default meta;
type Story = StoryObj;
const render = karmaRoute('administration/roles');
export const Default: Story = { render };
export const Loading: Story = {
  render,
  parameters: {
    holita: { scenario: { failures: { AdminKarmaRoles: 'pending' } } } satisfies StoryFixtures,
  },
};
export const ErrorState: Story = {
  name: 'Error',
  render,
  parameters: {
    holita: { scenario: { failures: { AdminKarmaRoles: 'network' } } } satisfies StoryFixtures,
  },
};
export const Mobile: Story = {
  render,
  globals: { viewport: { value: 'mobile375', isRotated: false } },
};
