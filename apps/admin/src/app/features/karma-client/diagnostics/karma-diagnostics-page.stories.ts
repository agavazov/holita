import type { Meta, StoryObj } from '@storybook/angular-vite';
import { registerKarmaDiagnosticStoryFixtures } from '../../../../storybook/karma-diagnostic-fixtures';
import {
  routeAt,
  StoryApp,
  storyLanguage,
  type StoryFixtures,
} from '../../../../storybook/story-config';
import { AdminWorkspace } from '../../../workspace/admin-workspace';
import { KarmaWorkspace } from '../karma-workspace';

const meta: Meta = {
  title: 'Admin/Karma Client/Trucks/Truck/Diagnostics',
  tags: ['!autodocs'],
  parameters: { holita: { signedIn: true } satisfies StoryFixtures },
  beforeEach: registerKarmaDiagnosticStoryFixtures,
};
export default meta;
type Story = StoryObj;

function routed(): NonNullable<Story['render']> {
  const path = 'karma-client/cars/41/diagnostics?fromMessageId=3000000600&toMessageId=3000000601';
  const route = routeAt(path);
  return (_args, context) => {
    const language = storyLanguage(context.globals);
    return {
      ...route(),
      props: {
        ...route().props,
        fixtureNotice:
          language === 'bg'
            ? 'Storybook · примерен камион и устройство. Потвърдените 419/NACK байтове са фиксирани снимки за преглед на интерфейса.'
            : 'Storybook · synthetic truck and device. Verified 419/NACK bytes are fixed snapshots for interface review.',
      },
      moduleMetadata: { imports: [StoryApp, AdminWorkspace, KarmaWorkspace] },
      template:
        '<p class="app-card" role="note">{{ fixtureNotice }}</p><holita-story-app [url]="url" />',
    };
  };
}

export const SourceReports: Story = { render: routed() };

export const Mobile: Story = {
  ...SourceReports,
  globals: { viewport: { value: 'mobile375', isRotated: false } },
};
