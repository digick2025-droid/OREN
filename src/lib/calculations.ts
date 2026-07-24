/**
 * Moteur de calcul des documents — fonctions pures, testées unitairement.
 * Le même moteur sert aux produits et aux prestations.
 * La base de données recalcule les mêmes règles à l'écriture (create_document).
 */

export interface LineInput {
  quantity: number | string;
  unit_price: number | string;
}

/**
 * Catégorie d'une ligne de devis/facture.
 * `article` (matériel/prestation) est la catégorie par défaut ; `main_oeuvre`
 * et `transport` sont des lignes à part, affichées après dans le
 * récapitulatif des totaux.
 */
export type LineCategory = "article" | "main_oeuvre" | "transport";

export const LINE_CATEGORIES: readonly LineCategory[] = [
  "article",
  "main_oeuvre",
  "transport",
] as const;

export interface CategorizedLineInput extends LineInput {
  category?: LineCategory;
}

export type CategoryTotals = Record<LineCategory, number>;

/**
 * Normalise un montant en nombre sûr.
 *
 * Les colonnes monétaires sont des `bigint` en base (migration 0010).
 * Selon la configuration, supabase-js / PostgREST peut renvoyer un
 * `bigint` sous forme de **chaîne** pour préserver la précision. Ce
 * helper accepte donc indifféremment un nombre ou une chaîne (et
 * null/undefined), et renvoie 0 si la valeur est absente ou invalide.
 * Les montants FCFA réels restent très en deçà de MAX_SAFE_INTEGER.
 */
export function parseAmount(value: number | string | null | undefined): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const n = Number(value.trim());
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
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
  const qty = parseAmount(line.quantity);
  const price = parseAmount(line.unit_price);
  return Math.round(qty * price);
}

export function computeTotals(
  items: LineInput[],
  options: {
    discount?: number | string;
    vatEnabled?: boolean;
    vatRate?: number | string;
  } = {},
): Totals {
  const subtotal = items.reduce((sum, item) => sum + lineTotal(item), 0);
  const discount = Math.min(Math.max(parseAmount(options.discount ?? 0), 0), subtotal);
  const net = subtotal - discount;
  const vatRate = options.vatEnabled ? Math.max(parseAmount(options.vatRate ?? 0), 0) : 0;
  const vatAmount = Math.round((net * vatRate) / 100);
  return { subtotal, discount, net, vatRate, vatAmount, total: net + vatAmount };
}

/**
 * Somme des lignes par catégorie (matériel/prestation, main d'œuvre,
 * transport). Une ligne sans catégorie est comptée comme `article`.
 */
export function computeCategoryTotals(
  items: CategorizedLineInput[],
): CategoryTotals {
  const totals: CategoryTotals = { article: 0, main_oeuvre: 0, transport: 0 };
  for (const item of items) {
    const category = item.category ?? "article";
    totals[category] += lineTotal(item);
  }
  return totals;
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
export function remainingToPay(
  total: number | string,
  advance: number | string,
): number {
  const t = parseAmount(total);
  const a = parseAmount(advance);
  return Math.max(t - Math.min(Math.max(a, 0), t), 0);
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
 * le paiement est exigé en aval) ; sinon compteur strict.
 *
 * Sémantique alignée sur la fonction SQL assert_quota (migration 0014) :
 * null et 0 laissent toujours passer ; seul un quota > 0 borne l'usage.
 */
export function canCreateDocument(
  used: number | string,
  quota: number | string | null,
): boolean {
  const q = quota === null ? null : parseAmount(quota);
  if (q === null || q === 0) return true;
  return parseAmount(used) < q;
}
