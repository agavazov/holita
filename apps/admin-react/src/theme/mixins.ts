import type { Breakpoint, MixinsOptions } from '@mui/material';

declare module '@mui/material/styles' {
  interface Mixins {
    topbar: { default: Partial<Record<Breakpoint, number>> };
    footer: Required<Pick<Record<Breakpoint, number>, 'xs' | 'sm'>>;
  }
}
const mixins: MixinsOptions = {
  topbar: { default: { xs: 64, md: 82 } },
  footer: { xs: 72, sm: 56 },
};
export default mixins;
