import type { Language } from '../i18n/i18n.js';
import type { ReactNode } from 'react';
import type { ShellIcon } from './primitives/icons.js';

export type NavigationItem = {
  key: string;
  label: string;
  icon: ShellIcon;
};
export type NavigationGroup = {
  key: string;
  label: string;
  items: readonly NavigationItem[];
};
export type AdminLayoutProps = {
  language: Language;
  onLanguageChange: (language: Language) => void;
  stores: readonly { id: string; name: string }[];
  selectedStoreId: string | null;
  storesLoading: boolean;
  navigationGroups: readonly NavigationGroup[];
  selectedSection: string;
  onStoreChange: (storeId: string) => void;
  onSectionChange: (section: string) => void;
  modeLabel?: string;
  controls?: ReactNode;
  children: ReactNode;
};
