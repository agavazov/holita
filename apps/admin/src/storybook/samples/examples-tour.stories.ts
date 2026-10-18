import type { Meta, StoryObj } from '@storybook/angular-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { exampleAt, exampleNavigation } from './example-app';

/**
 * All example pages in one app: start on the Overview and use the sidebar to visit every page.
 * Each page keeps its sample state (edits, filters) until the story is reloaded.
 */
const meta: Meta = {
  title: 'Examples/Tour',
  tags: ['!autodocs'],
};

export default meta;
type Story = StoryObj;

const appReady = { timeout: 10_000 };

export const AllPages: Story = {
  name: 'All pages',
  render: exampleAt('overview'),
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);
    await waitFor(() => expect(canvas.getByRole('heading', { level: 1 })).toBeVisible(), appReady);
    for (const item of exampleNavigation.flatMap((group) => group.items)) {
      await step(item.label, async () => {
        await userEvent.click(canvas.getByRole('link', { name: item.label }));
        await waitFor(
          () =>
            expect(canvas.getByRole('link', { name: item.label })).toHaveAttribute(
              'aria-current',
              'page',
            ),
          appReady,
        );
        await waitFor(() => expect(canvas.getByRole('heading', { level: 1 })).toBeVisible());
      });
    }
  },
};
