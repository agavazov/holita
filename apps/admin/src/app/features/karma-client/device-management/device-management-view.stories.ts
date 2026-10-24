import type { Meta, StoryObj } from '@storybook/angular-vite';
import type { StoryFixtures } from '../../../../storybook/story-config';
import { KarmaManagementScenario } from '../../../../storybook/karma-management-scenario';

const meta: Meta<KarmaManagementScenario> = {
  title: 'Admin/Karma Client/Device management proposal',
  component: KarmaManagementScenario,
  tags: ['!autodocs'],
  parameters: { holita: { signedIn: true } satisfies StoryFixtures },
  args: {
    language: 'en',
    device: false,
    hasScope: true,
    empty: false,
    loadState: 'ready',
    initialOperation: null,
    outcome: 'QUEUED',
  },
};
export default meta;
type Story = StoryObj<KarmaManagementScenario>;

export const InventoryToSettings: Story = {};
export const FullFlow: Story = { name: 'Full flow in application', args: { language: 'bg' } };
export const Settings: Story = { args: { device: true } };
export const Empty: Story = { args: { device: true, empty: true } };
export const MissingFleetScope: Story = {
  args: { device: true, hasScope: false },
};
export const WaitingForDevice: Story = { args: { device: true, initialOperation: 'WAITING' } };
export const UncertainOutcome: Story = { args: { device: true, initialOperation: 'UNKNOWN' } };
export const Loading: Story = { args: { device: true, loadState: 'loading' } };
export const ErrorState: Story = { args: { device: true, loadState: 'error' } };
export const Bulgarian: Story = { args: { language: 'bg' } };
export const Mobile: Story = {
  args: { language: 'bg', device: true },
  globals: { viewport: { value: 'mobile375', isRotated: false } },
};
export const Dark: Story = { args: { device: true }, globals: { theme: 'dark' } };
