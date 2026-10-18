import type { DensityName } from './theme-choice';

export interface Density {
  readonly name: DensityName;
  readonly title: string;
  readonly formField: { readonly paddingX: string; readonly paddingY: string };
  readonly listOptionPadding: string;
  readonly button: { readonly paddingX: string; readonly paddingY: string };
  readonly table: {
    readonly headerCellPadding: string;
    readonly bodyCellPadding: string;
    readonly bodyFontSize: string;
    readonly columnTitleFontSize: string;
  };
  readonly drawerContentPadding: string;
  /** `extend.app` values that change with the density. */
  readonly app: {
    readonly rowHeight: string;
    readonly controlHeight: string;
    readonly topbarHeight: string;
    readonly gutter: string;
    readonly panelPadding: string;
    readonly stackGap: string;
    readonly titleSize: string;
  };
}

export const densities: Readonly<Record<DensityName, Density>> = {
  compact: {
    name: 'compact',
    title: 'Compact',
    formField: { paddingX: '0.625rem', paddingY: '0.375rem' },
    listOptionPadding: '0.375rem 0.625rem',
    button: { paddingX: '0.75rem', paddingY: '0.375rem' },
    table: {
      headerCellPadding: '0.5rem 0.75rem',
      bodyCellPadding: '0.375rem 0.75rem',
      bodyFontSize: '0.8125rem',
      columnTitleFontSize: '0.6875rem',
    },
    drawerContentPadding: '0 1.25rem 1.25rem',
    app: {
      rowHeight: '3rem',
      controlHeight: '2.125rem',
      topbarHeight: '3.25rem',
      gutter: '1.25rem',
      panelPadding: '1rem',
      stackGap: '1rem',
      titleSize: '1.375rem',
    },
  },
  comfortable: {
    name: 'comfortable',
    title: 'Comfortable',
    formField: { paddingX: '0.75rem', paddingY: '0.5rem' },
    listOptionPadding: '0.5rem 0.75rem',
    button: { paddingX: '0.875rem', paddingY: '0.5rem' },
    table: {
      headerCellPadding: '0.625rem 1rem',
      bodyCellPadding: '0.625rem 1rem',
      bodyFontSize: '0.875rem',
      columnTitleFontSize: '0.75rem',
    },
    drawerContentPadding: '0 1.5rem 1.5rem',
    app: {
      rowHeight: '3.5rem',
      controlHeight: '2.5rem',
      topbarHeight: '3.5rem',
      gutter: '1.5rem',
      panelPadding: '1.25rem',
      stackGap: '1.25rem',
      titleSize: '1.5rem',
    },
  },
};
