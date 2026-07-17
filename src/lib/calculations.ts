/**
 * Moteur de calcul des documents — fonctions pures, testées unitairement.
 * Le même moteur sert aux produits et aux prestations.
 * La base de données recalcule les mêmes règles à l'écriture (create_document).
 */

export interface LineInput {
  quantity: number;
  unit_price: number;
}

export interface Totals {
  /** Somme des lignes */
  subtotal: number;
  /** Remise appliquée (bornée entre 0 et le sous-total) */
  discount: number;
  /** Montant HT après remise */
  net: number;
  /** Taux de TVA appliqué (0 si non assujetti) */
  vatRate: number;
  /** Montant de TVA, arrondi au franc */
  vatAmount: number;
  /** Total TTC */
  total: number;
}

export function lineTotal(line: LineInput): number {
  const qty = Number.isFinite(line.quantity) ? line.quantity : 0;
  const price = Number.isFinite(line.unit_price) ? line.unit_price : 0;
  return Math.round(qty * price);
}

export function computeTotals(
  items: LineInput[],
  options: { discount?: number; vatEnabled?: boolean; vatRate?: number } = {},
): Totals {
  const subtotal = items.reduce((sum, item) => sum + lineTotal(item), 0);
  const discount = Math.min(Math.max(options.discount ?? 0, 0), subtotal);
  const net = subtotal - discount;
  const vatRate = options.vatEnabled ? Math.max(options.vatRate ?? 0, 0) : 0;
  const vatAmount = Math.round((net * vatRate) / 100);
  return { subtotal, discount, net, vatRate, vatAmount, total: net + vatAmount };
}

/**
 * Parse une quantité saisie librement, tolérante à l'usage local :
 * - virgule décimale (« 1,5 » → 1.5)
 * - fraction (« 3/2 » → 1.5) pour surfaces/découpes
 * - espaces ignorés
 * Retourne 0 si la saisie est vide ou invalide (jamais négatif).
 */
export function parseQuantity(input: string): number {
  const cleaned = input.trim().replace(/\s+/g, "").replace(",", ".");
  if (cleaned === "") return 0;

  if (cleaned.includes("/")) {
    const [num, den] = cleaned.split("/");
    const n = Number(num);
    const d = Number(den);
    if (!Number.isFinite(n) || !Number.isFinite(d) || d === 0) return 0;
    return Math.max(n / d, 0);
  }

  const value = Number(cleaned);
  return Number.isFinite(value) ? Math.max(value, 0) : 0;
}

/** Reste à payer après acompte (borné entre 0 et le total). */
export function remainingToPay(total: number, advance: number): number {
  return Math.max(total - Math.min(Math.max(advance, 0), total), 0);
}

/** Formate un numéro de document : DEV-001, FAC-012, PRO-003… */
export function formatDocumentNumber(
  type: "devis" | "facture" | "proforma",
  counter: number,
): string {
  const prefix =
    type === "facture" ? "FAC-" : type === "proforma" ? "PRO-" : "DEV-";
  return prefix + String(counter).padStart(3, "0");
}

/**
 * Quota : true si la création d'un document supplémentaire est permise.
 * quota = null → illimité ; quota = 0 → paiement à l'usage (toujours permis,
 * le paiement est exigé en aval) ; sinon compteur mensuel strict.
 */
export function canCreateDocument(
  used: number,
  quota: number | null,
): boolean {
  if (quota === null || quota === 0) return true;
  return used < quota;
}
