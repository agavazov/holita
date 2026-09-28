import type { SxProps, Theme } from '@mui/material/styles';
type SxArray = Extract<SxProps<Theme>, readonly unknown[]>;
function isArray(value: SxProps<Theme>): value is SxArray {
  return Array.isArray(value);
}
export function sxArray(value: SxProps<Theme> | undefined): SxArray {
  return value === undefined ? [] : isArray(value) ? value : [value];
}
