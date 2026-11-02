import { applicationConfig, type Meta, type StoryObj } from '@storybook/angular-vite';
import { fixtureKarmaTrip } from '../../../../../storybook/karma-fixtures';
import { onFrame, storyLanguage } from '../../../../../storybook/story-config';
import { AdminConfig } from '../../../../core/config/admin-config';
import { TripDetails } from './trip-details';

const meta: Meta<TripDetails> = {
  title: 'Admin/Karma Client/Trucks/Truck/Trips/Trip details',
  component: TripDetails,
  decorators: [applicationConfig({ providers: [{ provide: AdminConfig, useValue: {} }] }), onFrame],
  tags: ['!autodocs'],
  args: { trip: fixtureKarmaTrip, showMap: true },
  render: (args, context) => ({
    props: { ...args, language: storyLanguage(context.globals) },
    template: `<holita-trip-details [language]="language" [trip]="trip" [showMap]="showMap" />`,
  }),
};
export default meta;
type Story = StoryObj<TripDetails>;

export const Endpoints: Story = {};
export const MissingEndpoints: Story = {
  args: {
    trip: {
      ...fixtureKarmaTrip,
      startLatitude: null,
      startLongitude: null,
      stopLatitude: null,
      stopLongitude: null,
    },
  },
};
export const ZeroAndMissingValues: Story = {
  args: {
    showMap: false,
    trip: {
      ...fixtureKarmaTrip,
      tripDistance: 0,
      tripDuration: 0,
      startOdo: 0,
      stopOdo: null,
      maxSpeed: 0,
    },
  },
};
export const UnconfirmedState: Story = {
  args: {
    showMap: false,
    trip: { ...fixtureKarmaTrip, tripActive: null, stopDate: null },
  },
};
export const Mobile: Story = {
  ...Endpoints,
  globals: { viewport: { value: 'mobile375', isRotated: false } },
};
