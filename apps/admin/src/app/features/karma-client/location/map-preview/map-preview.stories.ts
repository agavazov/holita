import { applicationConfig, type Meta, type StoryObj } from '@storybook/angular-vite';
import { expect, within } from 'storybook/test';
import { onFrame } from '../../../../../storybook/story-config';
import { AdminConfig } from '../../../../core/config/admin-config';
import { MapPreview } from './map-preview';

const meta: Meta<MapPreview> = {
  title: 'Admin/Karma Client/Maps',
  component: MapPreview,
  decorators: [onFrame],
  tags: ['!autodocs'],
  args: { language: 'en', origin: { latitude: 42.6977, longitude: 23.3219 } },
};
export default meta;
type Story = StoryObj<MapPreview>;

export const Location: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('heading', { name: 'Last reported location' })).toBeVisible();
    await expect(canvas.getByRole('link', { name: 'Open in Google Maps' })).toHaveAttribute(
      'href',
      'https://www.google.com/maps/search/?api=1&query=42.6977%2C23.3219',
    );
    await expect(canvasElement.querySelector('iframe')).toBeNull();
  },
};

export const TripEndpoints: Story = {
  args: { route: true, destination: { latitude: 42.1354, longitude: 24.7453 } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/does not supply the driven GPS track/)).toBeVisible();
    await expect(canvas.getByRole('link', { name: 'Open in Google Maps' })).toHaveAttribute(
      'href',
      expect.stringContaining('/maps/dir/?'),
    );
  },
};

export const ConfiguredPreview: Story = {
  decorators: [
    applicationConfig({
      providers: [
        { provide: AdminConfig, useValue: { googleMapsEmbedApiKey: 'storybook-map-key' } },
      ],
    }),
  ],
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole('button', { name: 'Load Google Maps' }),
    ).toBeVisible();
    // Leave the map unactivated so the story makes no requests to Google.
    await expect(canvasElement.querySelector('iframe')).toBeNull();
  },
};

export const MissingCoordinates: Story = {
  args: { origin: null },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('status')).toHaveTextContent('No valid coordinates');
    await expect(canvas.queryByRole('link')).toBeNull();
  },
};
