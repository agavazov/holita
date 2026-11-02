import type { Meta, StoryObj } from '@storybook/angular-vite';
import { fixtureKarmaMeasurementMessages } from '../../../../../storybook/karma-fixtures';
import { onFrame, storyLanguage } from '../../../../../storybook/story-config';
import { MeasurementWorkspace } from '../../../../ui/measurement-workspace/measurement-workspace';
import { edataChannels, edataRecords, measurementMessages } from './measurement-mapping';

const messages = fixtureKarmaMeasurementMessages.map((message) => ({
  ...message,
  parameters: message.parameters.map((parameter) => ({ ...parameter })),
}));
const records = edataRecords(messages, '2026-01-02T07:00:00.000Z');
const meta: Meta<MeasurementWorkspace> = {
  title: 'Admin/Karma Client/Trucks/Truck/eData/Measurements',
  component: MeasurementWorkspace,
  decorators: [onFrame],
  tags: ['!autodocs'],
  args: { identity: 'KARMA TEST 41', records },
  render: (args, context) => {
    const language = storyLanguage(context.globals);
    return {
      props: {
        ...args,
        language,
        channels: edataChannels(messages, language),
        scopeHint: measurementMessages(language).scopeHint,
        precisionNotes: Object.values(measurementMessages(language).precisionNotes),
        technicalDetails: measurementMessages(language).technicalDetails,
        selectedChannel: null,
        selectedRecord: null,
      },
      template: `<holita-measurement-workspace
        [language]="language" [identity]="identity" [scopeHint]="scopeHint"
        [channels]="channels" [records]="records" [loading]="loading" [error]="error"
        [selectedChannelKey]="selectedChannel" [selectedRecordKey]="selectedRecord"
        (selectedChannelKeyChange)="selectedChannel = $event"
        (selectedRecordKeyChange)="selectedRecord = $event" />
        <details class="app-source-details"><summary>{{ technicalDetails }}</summary>
        @for (note of precisionNotes; track $index) { <p>{{ note }}</p> }</details>`,
    };
  },
};
export default meta;
type Story = StoryObj<MeasurementWorkspace>;
export const Loaded: Story = {};
export const Empty: Story = { args: { records: [] } };
export const Loading: Story = { args: { records: null, loading: true } };
export const ErrorState: Story = {
  name: 'Error',
  args: { records: null, error: 'Measurements are unavailable.' },
};
export const Mobile: Story = {
  globals: { viewport: { value: 'mobile375', isRotated: false } },
};
