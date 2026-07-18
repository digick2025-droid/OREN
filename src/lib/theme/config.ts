export type Theme = "light" | "dark" | "system";

/** Thème par défaut : suit les réglages du téléphone. */
export const DEFAULT_THEME: Theme = "system";
export const THEME_COOKIE = "oren_theme";

export function parseTheme(value: string | undefined): Theme {
  return value === "light" || value === "dark" ? value : "system";
}

/** Résout le thème effectif (system → clair/sombre selon la préférence OS). */
export function resolveTheme(theme: Theme): "light" | "dark" {
  if (theme === "system") {
    if (typeof window === "undefined") return "light";
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }
  return theme;
}
