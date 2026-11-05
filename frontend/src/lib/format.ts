export function formatTotal(min: number): string {
  if (min % 1440 === 0) {
    const d = min / 1440;
    return d === 1 ? '1 día' : `${d} días`;
  }
  if (min >= 60 && min % 60 === 0) return `${min / 60} h`;
  return `${min} min`;
}