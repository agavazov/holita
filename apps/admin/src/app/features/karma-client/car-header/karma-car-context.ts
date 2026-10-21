import { convertToParamMap, type ParamMap } from '@angular/router';
import { positiveId } from '../edata/edata-page/edata-filters';
import { referenceListQuery } from '../reference-list-query';

interface CarListQuery {
  readonly q?: string;
  readonly size?: number;
  readonly first?: number;
  readonly project?: string;
}

interface CarListContext {
  readonly listQ?: string;
  readonly listSize?: number;
  readonly listFirst?: number;
  readonly listProject?: string;
}

function single(params: ParamMap, key: string): string | null {
  return params.getAll(key).length === 1 ? params.get(key) : null;
}

function listQuery(params: ParamMap): CarListQuery {
  const query = referenceListQuery(
    convertToParamMap({
      q: single(params, 'q') ?? '',
      size: single(params, 'size') ?? '50',
      first: single(params, 'first') ?? '0',
    }),
  );
  const search = Array.from(query.search).slice(0, 200).join('');
  const project = single(params, 'project');
  return {
    ...(search ? { q: search } : {}),
    ...(query.rows !== 50 ? { size: query.rows } : {}),
    ...(query.first ? { first: query.first } : {}),
    ...(project && positiveId(project) ? { project } : {}),
  };
}

/** Carry only bounded truck-list state; history filters have independent clock semantics. */
export function karmaCarListContext(params: ParamMap): CarListContext {
  const query = listQuery(params);
  return {
    ...(query.q ? { listQ: query.q } : {}),
    ...(query.size ? { listSize: query.size } : {}),
    ...(query.first ? { listFirst: query.first } : {}),
    ...(query.project ? { listProject: query.project } : {}),
  };
}

/** Restore the list state from a truck page without accepting arbitrary return URLs. */
export function karmaCarReturnQuery(params: ParamMap): CarListQuery {
  return listQuery(
    convertToParamMap({
      q: single(params, 'listQ') ?? '',
      size: single(params, 'listSize') ?? '50',
      first: single(params, 'listFirst') ?? '0',
      project: single(params, 'listProject') ?? '',
    }),
  );
}

/** Preserve the same list context when switching between a truck's sections. */
export function karmaCarNavigationContext(params: ParamMap): CarListContext {
  return karmaCarListContext(convertToParamMap(karmaCarReturnQuery(params)));
}
