"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/features/i18n/language-context";
import { suggestLineNames, type Metier } from "@/lib/catalog-templates";
import { cn } from "@/lib/utils";

/**
 * Champ « désignation » d'une ligne, avec suggestions par métier.
 *
 * Les suggestions sont éphémères : jamais enregistrées, sans prix. Elles ne
 * remplacent pas le catalogue (réservé aux offres qui ont la feature) — elles
 * évitent seulement la page blanche à la première ligne. Sans `metier`, le
 * champ se comporte exactement comme un Input nu.
 */
export function LineNameInput({
  value,
  onChange,
  metier,
  placeholder,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  metier: Metier | null;
  placeholder?: string;
  className?: string;
}) {
  const { t } = useI18n();
  const [focused, setFocused] = useState(false);
  const suggestions = focused ? suggestLineNames(metier, value) : [];

  return (
    <div className="relative min-w-0 flex-1">
      <Input
        className={className}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      />
      {suggestions.length > 0 && (
        <div className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-xl border border-border bg-card shadow-lg">
          <div className="px-3 pt-2 text-[10.5px] font-bold uppercase tracking-wide text-muted-foreground/70">
            {t.metier_suggestions}
          </div>
          {suggestions.map((name) => (
            <button
              key={name}
              type="button"
              // Empêche le blur de fermer la liste avant que le clic n'arrive.
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onChange(name);
                setFocused(false);
              }}
              className={cn(
                "block w-full px-3 py-2.5 text-left text-[13.5px] font-semibold text-navy",
                "hover:bg-surface",
              )}
            >
              {name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
