import type { Breakpoint, MixinsOptions } from '@mui/material';

declare module '@mui/material/styles' {
  interface Mixins {
    topbar: { default: Partial<Record<Breakpoint, number>> };
  }
}
const mixins: MixinsOptions = {
  topbar: { default: { xs: 64, md: 82 } },
};
export default mixins;
