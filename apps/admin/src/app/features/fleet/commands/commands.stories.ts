import { moduleMetadata, type Meta, type StoryObj } from '@storybook/angular-vite';
import {
  commandAcknowledgedFixture,
  commandFailedFixture,
  commandPendingFixture,
  commandRejectedFixture,
  commandUnknownFixture,
} from '../../../../storybook/erm-command-fixtures';
import { onFrame, storyLanguage } from '../../../../storybook/story-config';
import { CommandDetails } from './command-details';
import { CommandHistory } from './command-history';
import type { CommandRequest } from './command-presentation';

const meta: Meta = {
  title: 'Admin/Fleet/Devices/Commands',
  decorators: [moduleMetadata({ imports: [CommandHistory, CommandDetails] }), onFrame],
  tags: ['!autodocs'],
};
export default meta;
type Story = StoryObj;

const requests = [
  commandPendingFixture,
  commandAcknowledgedFixture,
  commandRejectedFixture,
  commandUnknownFixture,
  commandFailedFixture,
];
const target = 'CB 1001 AX · 001234567890123';

function modal(request: CommandRequest): NonNullable<Story['render']> {
  return (_args, context) => ({
    props: { request, target, language: storyLanguage(context.globals) },
    template:
      '<discocan-command-details [request]="request" [target]="target" [language]="language" (closed)="request = null" />',
  });
}

export const History: Story = {
  render: (_args, context) => ({
    props: { requests, target, language: storyLanguage(context.globals), selected: null },
    template:
      '<discocan-command-history [requests]="requests" [target]="target" [language]="language" (inspect)="selected = $event" /><discocan-command-details [request]="selected" [target]="target" [language]="language" (closed)="selected = null" />',
  }),
};
export const Pending: Story = { render: modal(commandPendingFixture) };
export const Acknowledged: Story = { render: modal(commandAcknowledgedFixture) };
export const Rejected: Story = { render: modal(commandRejectedFixture) };
export const Unknown: Story = { render: modal(commandUnknownFixture) };
export const Failed: Story = { render: modal(commandFailedFixture) };
export const Narrow: Story = {
  ...History,
  globals: { viewport: { value: 'mobile375', isRotated: false } },
};
export const Loading: Story = {
  render: (_args, context) => ({
    props: { target, language: storyLanguage(context.globals) },
    template:
      '<discocan-command-history [requests]="[]" [loading]="true" [target]="target" [language]="language" />',
  }),
};
