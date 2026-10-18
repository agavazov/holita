import { inject, type Signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, type ParamMap, Router } from '@angular/router';

/**
 * The query parameters of an example page: stories open pages on a state with `?scenario=` (e.g.
 * loading, empty, error, save-error) and on a record with `?drawer=<id|new>`. Story-only.
 */
export function injectQueryParams(): Signal<ParamMap> {
  const route = inject(ActivatedRoute);
  return toSignal(route.queryParamMap, { initialValue: route.snapshot.queryParamMap });
}

/**
 * For every path that closes a page's drawer: removes `?drawer=` (and the drivers' `&edit=`), so
 * a link to the same record, e.g. a notification, opens it again. Story-only.
 */
export function injectClearDrawer(): () => void {
  const router = inject(Router);
  const route = inject(ActivatedRoute);
  return () => {
    void router.navigate([], {
      relativeTo: route,
      queryParams: { drawer: null, edit: null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  };
}

export function scenarioOf<const T extends string>(
  params: ParamMap,
  scenarios: readonly T[],
): T | 'default' {
  return scenarios.find((scenario) => scenario === params.get('scenario')) ?? 'default';
}

/** Simulated latency of a save, long enough to see the busy state. */
export const saveDelayMs = 700;
