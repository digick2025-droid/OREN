/**
 * Unités de quantité courantes proposées à la saisie d'une ligne.
 * Liste non exhaustive : le champ reste un texte libre, ces valeurs ne sont
 * qu'un raccourci de saisie (voir `LineUnitSelect`).
 */
export const UNITS: readonly string[] = [
  "unité",
  "forfait",
  "m",
  "m²",
  "m³",
  "kg",
  "L",
  "h",
  "jour",
  "lot",
] as const;
