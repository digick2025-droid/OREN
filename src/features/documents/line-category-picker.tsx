"use client";

import { LINE_CATEGORIES, type LineCategory } from "@/lib/calculations";
import { useI18n } from "@/features/i18n/language-context";
import { cn } from "@/lib/utils";

/** Chips « Matériel/Prestation · Main d'œuvre · Transport » pour une ligne. */
export function LineCategoryPicker({
  value,
  onChange,
}: {
  value: LineCategory;
  onChange: (category: LineCategory) => void;
}) {
  const { t } = useI18n();
  const labels: Record<LineCategory, string> = {
    article: t.cat_article,
    main_oeuvre: t.cat_main_oeuvre,
    transport: t.cat_transport,
  };

  return (
    <div className="flex gap-1.5 overflow-x-auto">
      {LINE_CATEGORIES.map((category) => (
        <button
          key={category}
          type="button"
          onClick={() => onChange(category)}
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
