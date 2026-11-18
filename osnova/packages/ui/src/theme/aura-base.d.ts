// The runtime exports these values; the package declaration currently exposes only their types.
import type { BaseTokenSections } from '@primeuix/themes/aura/base';

declare module '@primeuix/themes/aura/base' {
  export const primitive: BaseTokenSections.Primitive;
  export const semantic: BaseTokenSections.Semantic;
}
