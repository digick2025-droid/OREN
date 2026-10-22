"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { LINE_CATEGORIES, type LineCategory } from "@/lib/calculations";
import { useI18n } from "@/features/i18n/language-context";
import { cn } from "@/lib/utils";

/**
 * Type de ligne « Matériel/Prestation · Main d'œuvre · Transport ».
 *
 * Replié par défaut sur la valeur courante : l'immense majorité des lignes
 * restent « Article », et trois puces par ligne alourdissaient chaque saisie.
 * Un tap déplie le choix, un second le referme.
 */
export function LineCategoryPicker({
  value,
  onChange,
}: {
  value: LineCategory;
  onChange: (category: LineCategory) => void;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const labels: Record<LineCategory, string> = {
    article: t.cat_article,
    main_oeuvre: t.cat_main_oeuvre,
    transport: t.cat_transport,
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-expanded={false}
        className="flex items-center gap-1 rounded-full py-1 text-[11.5px] font-semibold text-muted-foreground hover:text-navy"
      >
        {t.cat_type_label} : {labels[value]}
        <ChevronDown size={13} />
      </button>
    );
  }

  return (
    <div className="flex gap-1.5 overflow-x-auto" role="group" aria-label={t.cat_type_label}>
      {LINE_CATEGORIES.map((category) => (
        <button
          key={category}
          type="button"
          aria-pressed={value === category}
          onClick={() => {
            onChange(category);
            setOpen(false);
          }}
          className={cn(
            "shrink-0 rounded-full border-[1.5px] px-2.5 py-1 text-[11px] font-semibold transition-colors",
            value === category
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border bg-card text-muted-foreground",
          )}
        >
          {labels[category]}
        </button>
      ))}
    </div>
  );
}
