// Agrupa servicios por categoría en el orden en que aparece cada una; los que
// no tienen categoría van al final, bajo `fallback` (ej. "Otros")
export function groupByCategory<T extends { category: string | null }>(
  services: T[],
  fallback: string,
): [string, T[]][] {
  const groups = new Map<string, T[]>();
  const uncategorized: T[] = [];
  for (const s of services) {
    if (s.category) groups.set(s.category, [...(groups.get(s.category) ?? []), s]);
    else uncategorized.push(s);
  }
  if (uncategorized.length) {
    // si un negocio tiene una categoría llamada igual que `fallback`, se juntan
    groups.set(fallback, [...(groups.get(fallback) ?? []), ...uncategorized]);
  }
  return [...groups.entries()];
}
