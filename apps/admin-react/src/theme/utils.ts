// Color helpers retained from Aurora; demo utilities are deliberately not imported.
export function cssVarRgba(color: string | undefined, alpha: number) {
  if (!color) throw new Error('Missing theme color channel.');
  return `rgba(${color} / ${String(alpha)})`;
}

export function generatePaletteChannel<T extends Record<string, string>>(palette: T) {
  const channels: Record<string, string> = {};
  for (const [name, value] of Object.entries(palette)) {
    const red = parseInt(value.slice(1, 3), 16);
    const green = parseInt(value.slice(3, 5), 16);
    const blue = parseInt(value.slice(5, 7), 16);
    channels[`${name}Channel`] = `${String(red)} ${String(green)} ${String(blue)}`;
  }
  return Object.assign({}, palette, channels);
}
