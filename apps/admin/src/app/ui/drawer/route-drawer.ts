import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  type ElementRef,
  inject,
  Injector,
  input,
  output,
  viewChild,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Times } from '@primeicons/angular/times';
import { ConfirmationService } from 'primeng/api';
import { ButtonDirective } from 'primeng/button';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { Drawer } from 'primeng/drawer';
import { Skeleton } from 'primeng/skeleton';
import { confirmDialogPt, confirmDiscard } from '../confirm';
import { EmptyState } from '../empty-state/empty-state';
import { uiMessages } from '../i18n/messages';
import { UI_LANGUAGE } from '../ui-language';

export type RouteDrawerState = 'loading' | 'ready' | 'not-found' | 'invalid-id' | 'error';

let nextId = 0;

/**
 * The drawer of a child route: editing and record views open over their list or detail page.
 * Closing (button, Escape, backdrop) navigates to `closeLink`; the route's `leaveDrawer` guard
 * asks the host component, which calls `confirmLeave(dirty)`, so a canceled navigation keeps
 * the drawer open.
 */
@Component({
  selector: 'holita-route-drawer',
  imports: [Drawer, ConfirmDialog, ButtonDirective, Skeleton, EmptyState, Times],
  providers: [ConfirmationService],
  templateUrl: './route-drawer.html',
  styleUrl: './route-drawer.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(window:beforeunload)': 'beforeUnload($event)' },
})
export class RouteDrawer {
  readonly title = input.required<string>();
  readonly subtitle = input<string | null>(null);
  readonly size = input<'md' | 'lg'>('md');
  readonly state = input<RouteDrawerState>('ready');
  readonly errorText = input<string | null>(null);
  readonly saving = input(false);
  readonly dirty = input(false);
  readonly closeLink = input<readonly unknown[]>(['..']);
  readonly retry = output();

  protected readonly titleId = `route-drawer-title-${String(nextId++)}`;
  protected readonly text = computed(() => uiMessages[this.language()]);
  protected readonly confirmPt = computed(() => confirmDialogPt(this.language()));
  protected readonly drawerClass = computed(
    () => `app-route-drawer app-route-drawer--${this.size()}`,
  );
  private readonly language = inject(UI_LANGUAGE);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly confirmation = inject(ConfirmationService);
  private readonly injector = inject(Injector);
  private readonly drawer = viewChild.required(Drawer);
  private readonly heading = viewChild<ElementRef<HTMLElement>>('heading');
  private readonly trigger =
    document.activeElement instanceof HTMLElement ? document.activeElement : null;
  private pendingLeave: Promise<boolean> | null = null;
  private removeMaskListener: (() => void) | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.removeMaskListener?.();
      const target = this.trigger?.isConnected
        ? this.trigger
        : document.getElementById('page-title');
      target?.focus();
    });
  }

  /** Navigates to the close link; the route guard decides whether the drawer may leave. */
  close(): void {
    void this.router.navigate([...this.closeLink()], {
      relativeTo: this.route,
      queryParamsHandling: 'preserve',
      preserveFragment: true,
    });
  }

  /** For the host's `canLeave()`: confirms discarding a dirty draft; concurrent calls share one dialog. */
  confirmLeave(dirty: boolean): boolean | Promise<boolean> {
    if (!dirty) return true;
    this.pendingLeave ??= confirmDiscard(this.confirmation, this.language()).finally(() => {
      this.pendingLeave = null;
    });
    return this.pendingLeave;
  }

  focusTitle(): void {
    this.heading()?.nativeElement.focus();
  }

  protected shown(): void {
    const mask = this.drawer().mask;
    if (mask) {
      const listener = () => {
        this.close();
      };
      mask.addEventListener('click', listener);
      this.removeMaskListener = () => {
        mask.removeEventListener('click', listener);
      };
    }
    afterNextRender(
      () => {
        const container = this.heading()?.nativeElement.closest('.p-drawer');
        if (!container?.contains(document.activeElement)) this.focusTitle();
      },
      { injector: this.injector },
    );
  }

  protected escape(event: Event): void {
    // PrimeNG's drawer would drop its modality on Escape; the route decides instead.
    event.stopPropagation();
    if (!event.defaultPrevented) this.close();
  }

  protected beforeUnload(event: BeforeUnloadEvent): void {
    if (this.dirty()) event.preventDefault();
  }
}
