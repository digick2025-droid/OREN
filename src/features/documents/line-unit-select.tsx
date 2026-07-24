"use client";

import { UNITS } from "@/lib/units";
import { cn } from "@/lib/utils";

/**
 * Sélecteur d'unité compact (L, m², kg, unité…) pour une ligne.
 * La valeur reste un texte libre : si elle ne fait pas partie de la liste
 * courante (catalogue, document déjà enregistré…), elle est ajoutée comme
 * option supplémentaire plutôt que silencieusement remplacée.
 */
export function LineUnitSelect({
  value,
  onChange,
  className,
}: {
  value: string;
  onChange: (unit: string) => void;
  className?: string;
}) {
  const options = UNITS.includes(value) ? UNITS : [value, ...UNITS];

  return (
    <select
      aria-label="Unité"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        "h-8 rounded-lg border border-border bg-muted px-1.5 text-[12px] font-semibold text-muted-foreground",
        className,
      )}
    >
      {options.map((unit) => (
        <option key={unit} value={unit}>
          {unit}
        </option>
      ))}
    </select>
  );
}
