import type { UrlTree } from '@angular/router';

/** Icons the sidebar can render (a closed set mapped to @primeicons/angular components). */
export type NavIconName =
  | 'th-large'
  | 'bell'
  | 'directions'
  | 'truck'
  | 'id-card'
  | 'mobile'
  | 'wrench'
  | 'cog'
  | 'tags'
  | 'car'
  | 'users'
  | 'shield'
  | 'folder'
  | 'clock'
  | 'info-circle'
  | 'envelope';

export interface NavItem {
  readonly id: string;
  readonly label: string;
  readonly icon: NavIconName;
  readonly link: readonly string[];
  /** Match a parent path while linking to a default child, such as Dashboard's Overview tab. */
  readonly activePrefix?: readonly string[];
}

export interface NavGroup {
  readonly id: string;
  readonly label: string;
  /** A flat set of primary destinations, without a visible group heading. */
  readonly headingHidden?: boolean;
  /** Small tag after the group label (e.g. "temporary"). */
  readonly note?: string;
  readonly items: readonly NavItem[];
}

/**
 * The page shown in the topbar breadcrumb: optional group › page › record › optional tab. The
 * group is a label; the page links back to its list when a record page registered its name
 * (`injectPageRecord`). Explicit page metadata may also supply the document title.
 */
export interface PageContext {
  readonly group: string;
  readonly page: string;
  readonly title?: string;
  readonly pageLink?: readonly string[] | UrlTree;
  readonly record?: string | null;
  readonly recordLink?: readonly string[];
  readonly tab?: string;
}

function linkPath(link: readonly string[]): string {
  return `/${link.filter((segment) => segment !== '/').join('/')}`;
}

/** The navigation item whose link is the longest prefix of a URL path. */
export function navigationContext(
  navigation: readonly NavGroup[],
  path: string,
): PageContext | null {
  path = path.split(/[?#]/, 1)[0] ?? path;
  let match: { readonly length: number; readonly context: PageContext } | null = null;
  for (const group of navigation) {
    for (const item of group.items) {
      const prefix = linkPath(item.activePrefix ?? item.link);
      if (
        (path === prefix || path.startsWith(`${prefix}/`)) &&
        prefix.length > (match?.length ?? -1)
      ) {
        match = {
          length: prefix.length,
          context: {
            group: group.headingHidden ? '' : group.label,
            page: item.label,
            pageLink: item.link,
          },
        };
      }
    }
  }
  return match?.context ?? null;
}
