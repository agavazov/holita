import type { Meta, StoryObj } from '@storybook/angular-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
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

function routed(path: string): NonNullable<Story['render']> {
  return () => ({
    props: { url: `/en/karma-client/cars/41${path}` },
    moduleMetadata: { imports: [StoryApp, AdminWorkspace, KarmaWorkspace] },
    template: '<holita-story-app [url]="url" />',
  });
}

export const Overview: Story = {
  render: routed('?listQ=TEST&listSize=25&listFirst=25&listProject=12'),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(
      () => expect(canvas.getByRole('heading', { name: 'Truck details' })).toBeVisible(),
      { timeout: 10000 },
    );
    const nav = canvas.getByRole('navigation', { name: 'Truck sections' });
    await expect(within(nav).getAllByRole('link')).toHaveLength(6);
    await expect(within(nav).getByRole('link', { name: 'Overview' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    await expect(canvas.getByRole('link', { name: 'Back to trucks' })).toHaveAttribute(
      'href',
      '/en/karma-client/cars?q=TEST&size=25&first=25&project=12',
    );
  },
};

export const Location: Story = {
  render: routed('/location?listQ=TEST'),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() => expect(canvas.getByRole('heading', { name: 'Location' })).toBeVisible(), {
      timeout: 10000,
    });
    await waitFor(() =>
      expect(
        within(canvas.getByRole('navigation', { name: 'Truck sections' })).getByRole('link', {
          name: 'Location',
        }),
      ).toHaveAttribute('aria-current', 'page'),
    );
  },
};

export const SwitchSections: Story = {
  render: routed('?listQ=TEST&listSize=25'),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(
      () => expect(canvas.getByRole('heading', { name: 'Truck details' })).toBeVisible(),
      { timeout: 10000 },
    );
    await userEvent.click(
      within(canvas.getByRole('navigation', { name: 'Truck sections' })).getByRole('link', {
        name: 'Location',
      }),
    );
    // Distinct truck routes remount their scoped view; always query the currently mounted header.
    await waitFor(async () => {
      await expect(canvas.getByRole('heading', { name: 'Location' })).toBeVisible();
      await expect(
        within(canvas.getByRole('navigation', { name: 'Truck sections' })).getByRole('link', {
          name: 'Location',
        }),
      ).toHaveAttribute('aria-current', 'page');
    });
    await userEvent.click(
      within(canvas.getByRole('navigation', { name: 'Truck sections' })).getByRole('link', {
        name: 'Overview',
      }),
    );
    await waitFor(() =>
      expect(canvas.getByRole('heading', { name: 'Truck details' })).toBeVisible(),
    );
    await waitFor(() =>
      expect(
        within(canvas.getByRole('navigation', { name: 'Truck sections' })).getByRole('link', {
          name: 'Overview',
        }),
      ).toHaveAttribute('aria-current', 'page'),
    );
    await expect(canvas.getByRole('link', { name: 'Back to trucks' })).toHaveAttribute(
      'href',
      '/en/karma-client/cars?q=TEST&size=25',
    );
  },
};

export const Mobile: Story = {
  ...Location,
  globals: { viewport: { value: 'mobile375', isRotated: false } },
};
