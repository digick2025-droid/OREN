"use client";

import { useI18n } from "@/features/i18n/language-context";
import type { Lang } from "@/lib/i18n/config";
import { cn } from "@/lib/utils";

const LANGS: Array<{ key: Lang; label: string }> = [
  { key: "fr", label: "FR" },
  { key: "en", label: "EN" },
];

export function LanguageToggle({ dark = false }: { dark?: boolean }) {
  const { lang, setLang } = useI18n();

  return (
    <div
      className={cn(
        "inline-flex rounded-full p-0.5",
        dark ? "bg-white/10" : "bg-muted",
      )}
    >
      {LANGS.map((option) => (
        <button
          key={option.key}
          type="button"
          onClick={() => setLang(option.key)}
          className={cn(
            "rounded-full px-3 py-1 text-[12px] font-bold transition-colors",
            lang === option.key
              ? dark
                ? "bg-card text-navy"
                : "bg-navy text-white"
              : dark
                ? "text-white/60"
                : "text-muted-foreground/70",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
