/**
 * Catalogues pré-remplis par métier.
 *
 * Deux usages distincts :
 *  - seed du catalogue (`catalog_items`) pour les offres ayant la feature
 *    `catalog` — articles réels, modifiables et réutilisables ;
 *  - simple liste de suggestions (autocomplete) pour tous les autres cas,
 *    y compris Express : rien n'est écrit en base.
 *
 * ⚠️ Tous les `unit_price` sont volontairement à 0 tant qu'aucune donnée de
 * terrain n'est disponible. Un prix à 0 est un signal « à compléter », plus
 * honnête qu'un montant plausible mais faux qui partirait chez un client sans
 * être corrigé. Ne jamais les remplacer par une estimation inventée.
 */

export type Metier =
  | "electricien"
  | "plombier"
  | "menuisier"
  | "peintre"
  | "climaticien"
  | "general";

export const METIERS: readonly Metier[] = [
  "electricien",
  "plombier",
  "menuisier",
  "peintre",
  "climaticien",
  "general",
] as const;

export interface CatalogTemplateItem {
  name: string;
  type: "produit" | "prestation";
  unit: string;
  unit_price: number; // placeholder — ne jamais remplacer par une estimation inventée
}

export const CATALOG_TEMPLATES: Record<Metier, CatalogTemplateItem[]> = {
  electricien: [
    { name: "Recherche de panne", type: "prestation", unit: "forfait", unit_price: 0 },
    { name: "Installation prise électrique", type: "prestation", unit: "unité", unit_price: 0 },
    { name: "Pose disjoncteur", type: "prestation", unit: "unité", unit_price: 0 },
    { name: "Installation tableau électrique", type: "prestation", unit: "forfait", unit_price: 0 },
    { name: "Pose luminaire / plafonnier", type: "prestation", unit: "unité", unit_price: 0 },
    { name: "Câblage pièce complète", type: "prestation", unit: "forfait", unit_price: 0 },
  ],
  plombier: [
    { name: "Recherche de fuite", type: "prestation", unit: "forfait", unit_price: 0 },
    { name: "Débouchage canalisation", type: "prestation", unit: "forfait", unit_price: 0 },
    { name: "Installation robinet", type: "prestation", unit: "unité", unit_price: 0 },
    { name: "Pose chauffe-eau", type: "prestation", unit: "forfait", unit_price: 0 },
    { name: "Raccordement WC / lavabo", type: "prestation", unit: "unité", unit_price: 0 },
    { name: "Réparation fuite", type: "prestation", unit: "forfait", unit_price: 0 },
  ],
  menuisier: [
    { name: "Fabrication porte bois", type: "prestation", unit: "unité", unit_price: 0 },
    { name: "Pose fenêtre", type: "prestation", unit: "unité", unit_price: 0 },
    { name: "Fabrication meuble sur mesure", type: "prestation", unit: "forfait", unit_price: 0 },
    { name: "Réparation charpente", type: "prestation", unit: "forfait", unit_price: 0 },
    { name: "Pose plinthe", type: "prestation", unit: "mètre", unit_price: 0 },
    { name: "Vernissage / finition", type: "prestation", unit: "forfait", unit_price: 0 },
  ],
  peintre: [
    { name: "Peinture intérieure (par pièce)", type: "prestation", unit: "forfait", unit_price: 0 },
    { name: "Peinture façade extérieure", type: "prestation", unit: "m²", unit_price: 0 },
    { name: "Préparation support (ponçage, enduit)", type: "prestation", unit: "forfait", unit_price: 0 },
    { name: "Peinture plafond", type: "prestation", unit: "forfait", unit_price: 0 },
    { name: "Pose papier peint", type: "prestation", unit: "m²", unit_price: 0 },
  ],
  climaticien: [
    { name: "Installation climatiseur split", type: "prestation", unit: "unité", unit_price: 0 },
    { name: "Recharge gaz réfrigérant", type: "prestation", unit: "forfait", unit_price: 0 },
    { name: "Entretien / nettoyage climatiseur", type: "prestation", unit: "unité", unit_price: 0 },
    { name: "Diagnostic panne", type: "prestation", unit: "forfait", unit_price: 0 },
    { name: "Réparation groupe froid", type: "prestation", unit: "forfait", unit_price: 0 },
  ],
  // Volontairement vide : échappatoire pour qui ne se reconnaît dans aucun
  // profil — comportement identique à aujourd'hui (catalogue / formulaire vide).
  general: [],
};

/** Suggestions de désignation pour un métier, filtrées sur la saisie en cours. */
export function suggestLineNames(
  metier: Metier | null,
  query: string,
  limit = 5,
): string[] {
  if (!metier) return [];
  const items = CATALOG_TEMPLATES[metier];
  const q = query.trim().toLowerCase();
  const matches = q
    ? items.filter((item) => item.name.toLowerCase().includes(q))
    : items;
  // Une suggestion identique à la saisie n'apporte rien : on la masque.
  return matches
    .map((item) => item.name)
    .filter((name) => name.toLowerCase() !== q)
    .slice(0, limit);
}
