import {
  ChangeDetectionStrategy,
  Component,
  computed,
  type ElementRef,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { Bell } from '@primeicons/angular/bell';
import { ExclamationTriangle } from '@primeicons/angular/exclamation-triangle';
import { Send } from '@primeicons/angular/send';
import { Times } from '@primeicons/angular/times';
import { Wrench } from '@primeicons/angular/wrench';
import { ButtonDirective } from 'primeng/button';
import { Popover } from 'primeng/popover';
import type { Language } from '../i18n/messages';
import type { StatusTone } from '../theme/status-tones';
import { WALL_CLOCK } from '../ui/clock';
import { formatNumber, formatRelative } from '../ui/format/format';
import { interpolate } from '../ui/i18n/messages';
import bg from './notification-bg.json';
import en from './notification-en.json';

/** A display-ready feed entry. The workspace owns wording, targets and read state. */
export interface ShellNotification {
  readonly id: string;
  readonly title: string;
  readonly detail?: string | null;
  /** ISO instant, used only for relative time. */
  readonly at: string;
  /** The exact UTC title supplied by the Branch formatter. */
  readonly atTitle?: string;
  readonly unread: boolean;
  readonly category?: 'alert' | 'device' | 'command';
  readonly tone?: StatusTone;
}

const messages: Record<Language, typeof en> = { bg, en };

/** The recent feed popover; no business fetching or mutation takes place in the shell. */
@Component({
  selector: 'holita-notification-bell',
  imports: [RouterLink, ButtonDirective, Popover, Bell, ExclamationTriangle, Send, Times, Wrench],
  templateUrl: './notification-bell.html',
  styleUrl: './notification-bell.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotificationBell {
  readonly language = input.required<Language>();
  readonly notifications = input<readonly ShellNotification[]>([]);
  /** Whole-Branch unread count, independent of the latest-item page. */
  readonly unreadCount = input(0);
  readonly loading = input(false);
  readonly error = input<string | null>(null);
  readonly readAllowed = input(true);
  readonly busy = input(false);
  readonly seeAllLink = input<readonly string[] | null>(null);
  readonly notificationOpen = output<string>();
  readonly markAllRead = output();
  readonly retry = output();

  protected readonly text = computed(() => messages[this.language()]);
  protected readonly count = computed(() => formatNumber(this.unreadCount(), this.language()));
  protected readonly label = computed(() =>
    this.unreadCount()
      ? interpolate(this.text().unreadCount, { count: this.count() })
      : this.text().title,
  );
  private readonly clock = inject(WALL_CLOCK);
  private readonly now = signal(this.clock());
  protected readonly items = computed(() =>
    this.notifications().map((notification) => ({
      ...notification,
      relative: formatRelative(notification.at, this.now(), this.language()),
    })),
  );
  protected readonly popover = viewChild.required(Popover);
  private readonly trigger = viewChild.required<ElementRef<HTMLButtonElement>>('trigger');
  private readonly closeButton = viewChild.required<ElementRef<HTMLButtonElement>>('closeButton');

  /** Also used by the presentation stories to show the open popover. */
  show(): void {
    this.now.set(this.clock());
    this.popover().show(null, this.trigger().nativeElement);
  }

  protected toggle(event: Event): void {
    this.now.set(this.clock());
    this.popover().toggle(event);
  }

  protected close(): void {
    this.popover().hide();
    this.trigger().nativeElement.focus();
  }

  protected focusClose(): void {
    this.closeButton().nativeElement.focus();
  }

  protected open(id: string): void {
    this.close();
    this.notificationOpen.emit(id);
  }
}
