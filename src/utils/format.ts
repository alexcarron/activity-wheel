/** Tiny formatting helpers used in the UI. */

export function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatPercent(p: number): string {
  if (!isFinite(p)) return '—';
  return `${(p * 100).toFixed(1)}%`;
}

export function formatWeight(w: number): string {
  return w.toFixed(1);
}
