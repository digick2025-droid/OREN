/** Formatage des montants et dates (fr-FR, FCFA). */

export function formatAmount(value: number): string {
  return `${formatAmountShort(value)} FCFA`;
}

export function formatAmountShort(value: number): string {
  return Math.round(value || 0)
    .toLocaleString("fr-FR")
    .replace(/[  ]/g, " ");
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
