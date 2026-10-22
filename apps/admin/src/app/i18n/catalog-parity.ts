// Bulgarian/English catalog comparison for the app-wide parity check in messages.spec.ts.

function placeholders(text: string): string {
  return [...new Set([...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1] ?? ''))]
    .sort()
    .join(',');
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Every difference between two catalogs: key trees, empty strings and `{placeholder}` sets. */
export function catalogParityProblems(bg: unknown, en: unknown, path = ''): readonly string[] {
  if (typeof bg === 'string' || typeof en === 'string') {
    if (typeof bg !== 'string' || typeof en !== 'string') {
      return [`${path}: type differs`];
    }
    const problems: string[] = [];
    if (!bg.trim()) {
      problems.push(`${path}: empty in bg`);
    }
    if (!en.trim()) {
      problems.push(`${path}: empty in en`);
    }
    if (placeholders(bg) !== placeholders(en)) {
      problems.push(`${path}: placeholders differ (${placeholders(bg)} / ${placeholders(en)})`);
    }
    return problems;
  }
  if (Array.isArray(bg) || Array.isArray(en)) {
    if (!Array.isArray(bg) || !Array.isArray(en)) {
      return [`${path}: type differs`];
    }
    if (bg.length !== en.length) {
      return [`${path}: ${String(bg.length)} / ${String(en.length)} items`];
    }
    return bg.flatMap((item: unknown, index) =>
      catalogParityProblems(item, en[index], `${path}[${String(index)}]`),
    );
  }
  if (!isRecord(bg) || !isRecord(en)) {
    return [`${path || '(root)'}: expected strings or objects`];
  }
  const problems: string[] = [];
  const keys = new Set([...Object.keys(bg), ...Object.keys(en)]);
  for (const key of [...keys].sort()) {
    const child = path ? `${path}.${key}` : key;
    if (!(key in bg)) {
      problems.push(`${child}: missing in bg`);
    } else if (!(key in en)) {
      problems.push(`${child}: missing in en`);
    } else {
      problems.push(...catalogParityProblems(bg[key], en[key], child));
    }
  }
  return problems;
}
