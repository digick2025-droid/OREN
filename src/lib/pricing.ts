/**
 * Prix exprimés en valeur pour l'artisan : par jour, par document.
 * « 2 900 F / mois » se compare mal ; « moins de 100 F par jour » ou
 * « 116 F le document au lieu de 500 F » se décide tout seul.
 */

/** Prix mensuel ramené à la journée (30 jours), arrondi au franc supérieur. */
export function pricePerDay(monthlyFcfa: number): number {
  return Math.ceil(monthlyFcfa / 30);
}

/** Prix d'un document dans un forfait ; null si le forfait est illimité. */
export function pricePerDocument(
  monthlyFcfa: number,
  monthlyQuota: number | null,
): number | null {
  if (!monthlyQuota || monthlyQuota <= 0) return null;
  return Math.round(monthlyFcfa / monthlyQuota);
}

/**
 * À partir de combien de documents par mois le forfait coûte moins cher
 * que l'achat à l'unité.
 */
export function breakEvenDocuments(monthlyFcfa: number, unitFcfa: number): number {
  if (unitFcfa <= 0) return Infinity;
  return Math.floor(monthlyFcfa / unitFcfa) + 1;
}

/** Abonnement annuel : 12 mois pour le prix de 10 (2 mois offerts). */
export const ANNUAL_PAID_MONTHS = 10;

export function annualPrice(monthlyFcfa: number): number {
  return monthlyFcfa * ANNUAL_PAID_MONTHS;
}
