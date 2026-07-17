export type Lang = "fr" | "en";

export const DEFAULT_LANG: Lang = "fr";
export const LANG_COOKIE = "digick_lang";

export function parseLang(value: string | undefined): Lang {
  return value === "en" ? "en" : "fr";
}
