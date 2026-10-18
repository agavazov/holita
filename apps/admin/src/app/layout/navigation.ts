/** Icons the sidebar can render (a closed set mapped to @primeicons/angular components). */
export type NavIconName =
  | 'th-large'
  | 'bell'
  | 'directions'
  | 'truck'
  | 'id-card'
  | 'mobile'
  | 'wrench'
  | 'tags'
  | 'car'
  | 'users'
  | 'shield'
  | 'folder'
  | 'clock'
  | 'info-circle';

export interface NavItem {
  readonly id: string;
  readonly label: string;
  readonly icon: NavIconName;
  readonly link: readonly string[];
}

export interface NavGroup {
  readonly id: string;
  readonly label: string;
  /** Small tag after the group label (e.g. "temporary"). */
  readonly note?: string;
  readonly items: readonly NavItem[];
}

/**
 * The page shown in the topbar breadcrumb: navigation group › item › record. The group is a
 * label (navigation groups are not pages); the item links back to its list when a record page
 * registered its name (`injectPageRecord`).
 */
export interface PageContext {
  readonly group: string;
  readonly page: string;
  readonly pageLink?: readonly string[];
  readonly record?: string | null;
}

function linkPath(link: readonly string[]): string {
  return `/${link.filter((segment) => segment !== '/').join('/')}`;
}

/** The navigation item whose link is the longest prefix of a URL path. */
export function navigationContext(
  navigation: readonly NavGroup[],
  path: string,
): PageContext | null {
  let match: { readonly length: number; readonly context: PageContext } | null = null;
  for (const group of navigation)
    for (const item of group.items) {
      const prefix = linkPath(item.link);
      if (
        (path === prefix || path.startsWith(`${prefix}/`)) &&
        prefix.length > (match?.length ?? -1)
      )
        match = {
          length: prefix.length,
          context: { group: group.label, page: item.label, pageLink: item.link },
        };
    }
  return match?.context ?? null;
}
