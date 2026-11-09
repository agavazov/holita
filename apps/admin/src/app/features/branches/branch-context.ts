import { computed, inject, Injectable, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';
import type {
  AdminBranchesQuery,
  AdminDemoLoginMutation,
} from '../../../generated/graphql/operations';
import { DemoSession } from '../../core/auth/demo-session';
import { AdminConfig } from '../../core/config/admin-config';
import type { Language } from '../../i18n/messages';
import type { LeavableDrawer } from '../../ui/drawer/leave-drawer.guard';
import { BranchesApi } from './branches-api';

@Injectable()
export class BranchContext {
  private readonly session = inject(DemoSession);
  private readonly fleetEnabled = inject(AdminConfig).fleetEnabled;
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly api = inject(BranchesApi);
  private readonly navigation = toSignal(
    this.router.events.pipe(filter((event) => event instanceof NavigationEnd)),
  );
  private readonly branchState = signal<AdminBranchesQuery['branches'] | null>(null);
  readonly branches = this.branchState.asReadonly();
  readonly loading = signal(true);
  readonly error = signal<unknown>(null);
  readonly available = computed(() => (this.branches()?.length ?? 0) > 0);
  readonly required = computed(() => {
    this.navigation();
    return this.route.firstChild?.snapshot.data['requiresBranch'] !== false;
  });
  readonly selectedId = computed(() => {
    this.navigation();
    const id = this.required()
      ? this.route.firstChild?.snapshot.paramMap.get('branchId')?.toLowerCase()
      : this.session.branchId();
    return this.branches()?.find((branch) => branch.id === id)?.id ?? null;
  });
  private discoveryToken: string | null = null;
  private query: ReturnType<BranchesApi['watch']>['query'] | undefined;
  private defaultNavigationPaused = false;

  watch(language: Language): (() => void) | undefined {
    const session = this.session.current();
    if ((session?.token ?? null) !== this.discoveryToken) {
      this.branchState.set(null);
      this.discoveryToken = session?.token ?? null;
    }
    if (!session) {
      return;
    }
    this.loading.set(true);
    this.error.set(null);
    const { query, close } = this.api.watch(language);
    this.query = query;
    const subscription = query.valueChanges.subscribe({
      next: (result) => {
        this.loading.set(result.loading);
        this.error.set(result.error ?? null);
        if (result.dataState === 'complete') {
          this.branchState.set(result.data.branches);
        }
      },
      error: (error: unknown) => {
        this.loading.set(false);
        this.error.set(error);
      },
    });
    return () => {
      subscription.unsubscribe();
      close();
      this.query = undefined;
    };
  }

  synchronizeRoute(language: Language): void {
    this.navigation();
    const branches = this.branches();
    const selected = this.selectedId();
    if (this.session.current() && this.session.branchId() && branches?.length) {
      if (selected) {
        this.session.selectBranch(selected);
      } else if (!this.route.firstChild && !this.defaultNavigationPaused) {
        const branch =
          branches.find((branch) => branch.id === this.session.branchId()) ?? branches[0];
        if (branch) {
          void this.router.navigate(['/', language, branch.id, 'fleet', 'live'], {
            replaceUrl: true,
            queryParamsHandling: 'preserve',
            preserveFragment: true,
          });
        }
      }
    }
  }

  async enter(
    selection: {
      session: AdminDemoLoginMutation['demoLogin'];
      branchId: string;
    },
    language: Language,
  ): Promise<void> {
    const destination = this.router.createUrlTree(
      ['/', language, selection.branchId, 'fleet', 'live'],
      { queryParamsHandling: 'preserve', preserveFragment: true },
    );
    if (
      this.router.url === this.router.serializeUrl(destination) ||
      (await this.router.navigateByUrl(destination))
    ) {
      this.session.start(selection.session, selection.branchId);
    }
  }

  pauseDefaultNavigation(): () => void {
    this.defaultNavigationPaused = true;
    return () => {
      this.defaultNavigationPaused = false;
    };
  }

  clear(): void {
    this.branchState.set(null);
  }

  refresh(): void {
    const query = this.query;
    void query?.refetch().catch((error: unknown) => {
      if (this.query === query) {
        this.error.set(error);
      }
    });
  }

  async choose(id: string, language: Language, activePage: LeavableDrawer | null): Promise<void> {
    if (!this.required()) {
      if (activePage && !(await activePage.canLeave())) {
        return;
      }
      this.session.selectBranch(id);
      return;
    }
    const section = this.route.firstChild?.snapshot.url;
    const resource = section?.[2]?.path;
    const tab = section?.[3]?.path;
    let destination = ['live'];
    if (this.fleetEnabled && section?.[1]?.path === 'fleet') {
      if (resource === 'dashboard' && tab && ['overview', 'problems', 'trips'].includes(tab)) {
        destination = ['dashboard', tab];
      } else if (resource === 'settings' && (tab === 'groups' || tab === 'general')) {
        destination = ['settings', tab];
      } else if (
        resource &&
        ['vehicles', 'devices', 'drivers', 'maintenance', 'notifications'].includes(resource)
      ) {
        destination = [resource];
      }
    }
    void this.router.navigate(['/', language, id, 'fleet', ...destination]);
  }
}
