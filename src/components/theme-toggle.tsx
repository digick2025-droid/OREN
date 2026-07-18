"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "@/features/theme/theme-context";
import { useI18n } from "@/features/i18n/language-context";
import type { Theme } from "@/lib/theme/config";
import { cn } from "@/lib/utils";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const { t } = useI18n();

  const options: Array<{ key: Theme; label: string; Icon: typeof Sun }> = [
    { key: "light", label: t.theme_light, Icon: Sun },
    { key: "dark", label: t.theme_dark, Icon: Moon },
    { key: "system", label: t.theme_system, Icon: Monitor },
  ];

  return (
    <div className="inline-flex rounded-full bg-muted p-0.5">
      {options.map(({ key, label, Icon }) => (
        <button
          key={key}
          type="button"
          onClick={() => setTheme(key)}
          aria-label={label}
          aria-pressed={theme === key}
          className={cn(
            "flex items-center justify-center rounded-full px-3 py-1.5 transition-colors",
            theme === key
              ? "bg-card text-accent shadow-sm"
              : "text-muted-foreground",
          )}
        >
          <Icon size={15} />
        </button>
      ))}
    </div>
  );
}
