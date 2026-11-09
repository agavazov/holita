import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  viewChild,
} from '@angular/core';
import type { Meta, StoryObj } from '@storybook/angular-vite';
import { defaultBranchId } from '../../storybook/session-fixtures';
import { UI_LANGUAGE } from '../ui/ui-language';
import { NotificationBell, type ShellNotification } from './notification-bell';

type State = 'empty' | 'unread' | 'many';

@Component({
  selector: 'discocan-notification-bell-preview',
  imports: [NotificationBell],
  template: `
    <discocan-notification-bell
      [language]="language()"
      [notifications]="notifications()"
      [unreadCount]="unreadCount()"
      [seeAllLink]="seeAllLink()"
    />
  `,
  styles: `
    :host {
      display: flex;
      justify-content: flex-end;
      align-items: flex-start;
      min-block-size: 38rem;
      padding: var(--p-app-space-5);
      background: var(--p-app-canvas-background);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class NotificationBellPreview {
  readonly state = input<State>('unread');
  readonly language = inject(UI_LANGUAGE);
  readonly seeAllLink = computed(() => [
    '/',
    this.language(),
    defaultBranchId,
    'fleet',
    'notifications',
  ]);
  readonly notifications = computed<readonly ShellNotification[]>(() => {
    if (this.state() === 'empty') {
      return [];
    }
    const bg = this.language() === 'bg';
    const recent: readonly ShellNotification[] = [
      {
        id: 'alert-1',
        title: bg
          ? 'Отворено е критично предупреждение „Ниско налягане на маслото“ за CB 1001 AX.'
          : 'Critical alert “Low oil pressure” opened for CB 1001 AX.',
        category: 'alert',
        tone: 'danger',
        at: '2026-10-18T06:58:00.000Z',
        atTitle: '2026-10-18T06:58:00.000Z',
        unread: true,
      },
      {
        id: 'evidence-1',
        title: bg
          ? 'Устройство 359632100000001 записа код за неизправност P0299 за CB 1002 AX.'
          : 'Device 359632100000001 recorded fault code P0299 for CB 1002 AX.',
        category: 'device',
        tone: 'warn',
        at: '2026-10-18T06:40:00.000Z',
        atTitle: '2026-10-18T06:40:00.000Z',
        unread: true,
      },
      {
        id: 'command-1',
        title: bg
          ? 'Командата за текущи данни към устройство 359632100000002 е потвърдена.'
          : 'The current-data command for device 359632100000002 was confirmed.',
        category: 'command',
        tone: 'success',
        at: '2026-10-18T05:00:00.000Z',
        atTitle: '2026-10-18T05:00:00.000Z',
        unread: false,
      },
    ];
    return this.state() === 'many'
      ? [
          ...recent,
          ...Array.from({ length: 9 }, (_, index) => ({
            ...recent[index % recent.length],
            id: `older-${String(index)}`,
            title: bg
              ? `Устройство 35963210000000${String(index)} записа аларма за прекъснато захранване.`
              : `Device 35963210000000${String(index)} recorded a power-loss alarm.`,
            category: 'device' as const,
            tone: 'warn' as const,
            at: '2026-10-17T18:00:00.000Z',
            atTitle: '2026-10-17T18:00:00.000Z',
            unread: true,
          })),
        ]
      : recent;
  });
  readonly unreadCount = computed(() =>
    this.state() === 'empty' ? 0 : this.state() === 'many' ? 245 : 7,
  );
  private readonly bell = viewChild.required(NotificationBell);

  constructor() {
    afterNextRender(() => {
      this.bell().show();
    });
  }
}

const meta: Meta = {
  title: 'Admin/Notifications/Bell',
  tags: ['!autodocs'],
};

export default meta;
type Story = StoryObj;

function preview(state: State): NonNullable<Story['render']> {
  return () => ({
    moduleMetadata: { imports: [NotificationBellPreview] },
    props: { state },
    template: '<discocan-notification-bell-preview [state]="state" />',
  });
}

export const Empty: Story = { render: preview('empty') };
export const Unread: Story = { render: preview('unread') };
export const Many: Story = { render: preview('many') };
