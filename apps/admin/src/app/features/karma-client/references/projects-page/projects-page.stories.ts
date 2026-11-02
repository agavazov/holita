import type { Meta, StoryObj } from '@storybook/angular-vite';
import { karmaRoute } from '../../../../../storybook/karma-route';
import type { StoryFixtures } from '../../../../../storybook/story-config';

const meta: Meta = { title: 'Admin/Karma Client/Administration/Projects', tags: ['!autodocs'] };
export default meta;
type Story = StoryObj;
const render = karmaRoute('administration/projects');
export const Default: Story = { render };
export const Loading: Story = {
  render,
  parameters: {
    holita: { scenario: { failures: { AdminKarmaProjects: 'pending' } } } satisfies StoryFixtures,
  },
};
export const ErrorState: Story = {
  name: 'Error',
  render,
  parameters: {
    holita: { scenario: { failures: { AdminKarmaProjects: 'network' } } } satisfies StoryFixtures,
  },
};
export const Mobile: Story = {
  render,
  globals: { viewport: { value: 'mobile375', isRotated: false } },
};
