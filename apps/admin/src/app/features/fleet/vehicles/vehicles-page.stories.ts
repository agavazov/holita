import type { Meta, StoryObj } from '@storybook/angular-vite';
import { defaultBranchId } from '../../../../storybook/session-fixtures';
import { routeAt, StoryApp, type StoryFixtures } from '../../../../storybook/story-config';

const vehicles = `${defaultBranchId}/fleet/vehicles`;

const meta: Meta<StoryApp> = {
  title: 'Screens/Fleet/Vehicles',
  component: StoryApp,
  render: routeAt(vehicles),
  tags: ['!autodocs'],
};

export default meta;
type Story = StoryObj<StoryApp>;

export const Default: Story = {};

export const Loading: Story = {
  parameters: {
    holita: { scenario: { failures: { AdminVehicles: 'pending' } } } satisfies StoryFixtures,
  },
};

export const Empty: Story = {
  parameters: { holita: { emptyFleet: true } satisfies StoryFixtures },
};

export const NoResults: Story = {
  render: routeAt(`${vehicles}?search=ZZ9999`),
};

export const LoadError: Story = {
  parameters: {
    holita: { scenario: { failures: { AdminVehicles: 'network' } } } satisfies StoryFixtures,
  },
};

export const SortedSecondPage: Story = {
  render: routeAt(`${vehicles}?page=2&pageSize=10&sort=licensePlate&order=asc`),
};

export const Create: Story = {
  render: routeAt(`${vehicles}/new`),
};

export const Edit: Story = {
  render: routeAt(`${vehicles}/30000000-0000-4000-8000-000000000005/edit`),
};

export const Dark: Story = {
  globals: { theme: 'dark' },
};
