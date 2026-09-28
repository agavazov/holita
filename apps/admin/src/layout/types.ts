import type { ReactNode } from 'react';
import type { ShellIcon } from './primitives/icons.js';

export type NavigationItem = {
  key: string;
  label: string;
  icon: ShellIcon;
  children?: readonly NavigationItem[];
};
export type NavigationGroup = {
  key: string;
  label: string;
  icon: ShellIcon;
  items: readonly NavigationItem[];
};
export type AdminLayoutProps = {
  stores: readonly { id: string; name: string }[];
  selectedStoreId: string | null;
  storesLoading: boolean;
  navigationGroups: readonly NavigationGroup[];
  selectedSection: string;
  onStoreChange: (storeId: string) => void;
  onSectionChange: (section: string) => void;
  children: ReactNode;
};

export function containsSection(items: readonly NavigationItem[], section: string): boolean {
  return items.some(
    (item) => item.key === section || (item.children && containsSection(item.children, section)),
  );
}
