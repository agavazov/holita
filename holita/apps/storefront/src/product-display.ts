export function hasLongBadge(badges: readonly { readonly name: string }[]): boolean {
  return badges.some(({ name }) => Array.from(name).length >= 40);
}
