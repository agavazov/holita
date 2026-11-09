import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import type { Meta, StoryObj } from '@storybook/angular-vite';
import { MessageService, type ToastMessageOptions } from 'primeng/api';
import { ButtonDirective } from 'primeng/button';
import { onFrame } from '../../storybook/story-config';

const examples = {
  success: { severity: 'success', summary: 'Settings saved.' },
  warning: {
    severity: 'warn',
    summary: '3 of 5 records were updated.',
    detail: 'The remaining 2 records could not be changed. Review them and retry.',
    sticky: true,
  },
  error: {
    severity: 'error',
    summary: 'The update could not be completed.',
    detail: 'The connection was interrupted. Retry the operation.',
    sticky: true,
  },
  long: {
    severity: 'error',
    summary: 'The device configuration could not be updated.',
    detail:
      'Device tracker-north-region-international-deliveries-warehouse-configuration-2026: the connection was interrupted. The current configuration is unchanged. Review the device connection and retry the operation.',
    sticky: true,
  },
} satisfies Record<string, ToastMessageOptions>;

@Component({
  selector: 'discocan-notifications-demo',
  imports: [ButtonDirective],
  template: `
    <h1>Operation feedback</h1>
    <p>Completion feedback uses the same toast outside tables, including settings and forms.</p>
    <button pButton type="button" (click)="show()">Show notification</button>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class NotificationsDemo {
  readonly scenario = input<keyof typeof examples | 'stacked'>('success');
  private readonly messages = inject(MessageService);

  protected show(): void {
    const scenario = this.scenario();
    if (scenario === 'stacked') {
      this.messages.addAll(
        [examples.success, examples.warning, examples.error].map((message) => ({ ...message })),
      );
    } else {
      this.messages.add({ ...examples[scenario] });
    }
  }
}

const meta: Meta<NotificationsDemo> = {
  title: 'Design System/Patterns/Notifications',
  component: NotificationsDemo,
  decorators: [onFrame],
  tags: ['!autodocs'],
};

export default meta;
type Story = StoryObj<NotificationsDemo>;

export const Success: Story = {};

export const Warning: Story = {
  args: { scenario: 'warning' },
};

export const ErrorState: Story = {
  name: 'Error',
  args: { scenario: 'error' },
};

export const LongMessage: Story = {
  name: 'Long message',
  args: { scenario: 'long' },
};

export const Stacked: Story = {
  args: { scenario: 'stacked' },
};
