import type { ParamMap } from '@angular/router';

export function referenceListQuery(params: ParamMap) {
  const size = Number(params.get('size') ?? 50);
  const first = Number(params.get('first') ?? 0);
  const rows = [25, 50, 100].includes(size) ? size : 50;
  return {
    search: (params.get('q') ?? '').trim(),
    rows,
    first: Number.isSafeInteger(first) && first >= 0 && first % rows === 0 ? first : 0,
  };
}
