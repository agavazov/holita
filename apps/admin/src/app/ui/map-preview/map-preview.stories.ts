import { applicationConfig, type Meta, type StoryObj } from '@storybook/angular-vite';
import { onFrame } from '../../../storybook/story-config';
import { AdminConfig } from '../../core/config/admin-config';
import { MapPreview } from './map-preview';

// Synthetic offshore points; no account locations or real browser key are used.
const origin = { latitude: 0.125, longitude: 0.25 };
const destination = { latitude: 0.25, longitude: 0.5 };
const configured = applicationConfig({
  providers: [{ provide: AdminConfig, useValue: { googleMapsEmbedApiKey: 'storybook-map-key' } }],
});

const meta: Meta<MapPreview> = {
  title: 'Design System/Patterns/Map preview',
  component: MapPreview,
  decorators: [applicationConfig({ providers: [{ provide: AdminConfig, useValue: {} }] }), onFrame],
  tags: ['!autodocs'],
  args: {
    pageType: 'location',
    origin,
    identity: 'Synthetic location 41',
    originTime: '2026-01-01 09:59:00',
  },
};
export default meta;
type Story = StoryObj<MapPreview>;

export const Location: Story = {};
export const StreetView: Story = { args: { initialView: 'streetview' } };

export const TripEndpoints: Story = {
  args: {
    pageType: 'trip-details',
    route: true,
    identity: 'Synthetic trip 9000000001',
    destination,
    destinationTime: '2026-01-01 10:29:00',
  },
};

/** The selected preview loads automatically with a fake key and synthetic points. */
export const ConfiguredPreview: Story = {
  decorators: [configured],
  args: { route: true, destination, destinationTime: '2026-01-01 10:29:00' },
};

export const MissingCoordinates: Story = { args: { origin: null, originTime: null } };
export const Collapsed: Story = { args: { pageType: 'preview' } };
export const EndOnly: Story = {
  args: { route: true, origin: null, originTime: null, destination, destinationTime: null },
};
export const Mobile: Story = {
  ...TripEndpoints,
  globals: { viewport: { value: 'mobile375', isRotated: false } },
};
