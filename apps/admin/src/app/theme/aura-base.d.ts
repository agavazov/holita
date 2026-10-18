// @primeuix/themes 3.0.1 ships `aura/base/index.mjs` with `default`, `primitive` and `semantic`
// exports, but its `index.d.ts` declares only the token types. This restores the value exports
// with the package's own token types (the same shape `aura-compat/base` declares).
declare module '@primeuix/themes/aura/base' {
  import type { BaseTokenSections } from '@primeuix/themes/types/base';

  export type {
    BaseDesignTokens,
    BaseDesignTokens as AuraBaseDesignTokens,
    BaseTokenSections,
  } from '@primeuix/themes/types/base';

  export const primitive: BaseTokenSections.Primitive;
  export const semantic: BaseTokenSections.Semantic;
  const base: {
    readonly primitive: BaseTokenSections.Primitive;
    readonly semantic: BaseTokenSections.Semantic;
  };
  export default base;
}
