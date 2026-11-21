import type { OperatorCategoryFieldsFragment } from '../generated/categories-operations';

export interface CategoryRow extends OperatorCategoryFieldsFragment {
  readonly depth: number;
  readonly path: string;
}

/** Category reads visit parents before their descendants. */
export function categoryRows(categories: readonly OperatorCategoryFieldsFragment[]): CategoryRow[] {
  const rows = new Map<string, CategoryRow>();
  for (const category of categories) {
    const parent = category.parentId ? rows.get(category.parentId) : undefined;
    rows.set(category.id, {
      ...category,
      depth: parent ? parent.depth + 1 : 0,
      path: parent ? `${parent.path} / ${category.name}` : category.name,
    });
  }
  return [...rows.values()];
}

export function categoryOptions(
  categories: readonly OperatorCategoryFieldsFragment[],
  emptyLabel: string,
  excludeId?: string | null,
): { id: string | null; name: string }[] {
  const options: { id: string | null; name: string }[] = [{ id: null, name: emptyLabel }];
  const excluded = new Set(excludeId ? [excludeId] : []);
  for (const category of categoryRows(categories)) {
    if (excluded.has(category.id) || (category.parentId && excluded.has(category.parentId))) {
      excluded.add(category.id);
    } else {
      options.push({ id: category.id, name: category.path });
    }
  }
  return options;
}
