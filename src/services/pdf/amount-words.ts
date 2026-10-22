/**
 * Montants en toutes lettres — mention « Arrêté le présent devis à la somme
 * de … » des devis, proformas et factures (usage OHADA).
 *
 * Français : orthographe traditionnelle (traits d'union sous cent
 * seulement), avec les règles d'accord :
 *  - « et » pour 21, 31, 41, 51, 61, 71 ; pas pour 81 et 91 ;
 *  - « vingts » et « cents » prennent un s quand ils sont multipliés et
 *    terminent le nombre, ou précèdent million / milliard (des noms),
 *    mais pas devant « mille » (adjectif) ;
 *  - « mille » est invariable et ne prend pas « un » ;
 *  - « million » et « milliard » s'accordent.
 */

const FR_UNITS = [
  "zéro", "un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf",
  "dix", "onze", "douze", "treize", "quatorze", "quinze", "seize",
  "dix-sept", "dix-huit", "dix-neuf",
];
const FR_TENS = ["", "", "vingt", "trente", "quarante", "cinquante", "soixante"];

/** 0–99. `finalPlural` : « quatre-vingts » quand rien ne suit. */
function frBelow100(n: number, finalPlural: boolean): string {
  if (n < 20) return FR_UNITS[n] ?? "";
  if (n < 70) {
    const ten = Math.floor(n / 10);
    const unit = n % 10;
    const tenWord = FR_TENS[ten] ?? "";
    if (unit === 0) return tenWord;
    if (unit === 1) return `${tenWord} et un`;
    return `${tenWord}-${FR_UNITS[unit]}`;
  }
  if (n < 80) {
    // 70–79 : soixante-dix, soixante et onze, soixante-douze…
    const rest = n - 60;
    return rest === 11 ? "soixante et onze" : `soixante-${FR_UNITS[rest]}`;
  }
  // 80–99
  const rest = n - 80;
  if (rest === 0) return finalPlural ? "quatre-vingts" : "quatre-vingt";
  return `quatre-vingt-${FR_UNITS[rest]}`;
}

/** 0–999 ; `finalPlural` vaut pour « cents » et « quatre-vingts ». */
function frBelow1000(n: number, finalPlural: boolean): string {
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  const parts: string[] = [];
  if (hundreds === 1) parts.push("cent");
  else if (hundreds > 1) {
    parts.push(`${FR_UNITS[hundreds]} ${rest === 0 && finalPlural ? "cents" : "cent"}`);
  }
  if (rest > 0) parts.push(frBelow100(rest, finalPlural));
  return parts.join(" ");
}

export function numberToFrenchWords(value: number): string {
  let n = Math.floor(Math.abs(value));
  if (n === 0) return "zéro";

  const billions = Math.floor(n / 1_000_000_000);
  n %= 1_000_000_000;
  const millions = Math.floor(n / 1_000_000);
  n %= 1_000_000;
  const thousands = Math.floor(n / 1000);
  const rest = n % 1000;

  const parts: string[] = [];
  if (billions > 0) {
    parts.push(`${frBelow1000(billions, true)} ${billions > 1 ? "milliards" : "milliard"}`);
  }
  if (millions > 0) {
    parts.push(`${frBelow1000(millions, true)} ${millions > 1 ? "millions" : "million"}`);
  }
  if (thousands > 0) {
    // Devant « mille » : pas de « un », pas de s à vingt / cent.
    parts.push(thousands === 1 ? "mille" : `${frBelow1000(thousands, false)} mille`);
  }
  if (rest > 0) parts.push(frBelow1000(rest, true));
  return parts.join(" ");
}

const EN_UNITS = [
  "zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine",
  "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen",
  "seventeen", "eighteen", "nineteen",
];
const EN_TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];

function enBelow1000(n: number): string {
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  const parts: string[] = [];
  if (hundreds > 0) parts.push(`${EN_UNITS[hundreds]} hundred`);
  if (rest > 0) {
    if (rest < 20) parts.push(EN_UNITS[rest] ?? "");
    else {
      const tens = EN_TENS[Math.floor(rest / 10)] ?? "";
      const unit = rest % 10;
      parts.push(unit ? `${tens}-${EN_UNITS[unit]}` : tens);
    }
  }
  return parts.join(" ");
}

export function numberToEnglishWords(value: number): string {
  let n = Math.floor(Math.abs(value));
  if (n === 0) return "zero";
  const scales: Array<[number, string]> = [
    [1_000_000_000, "billion"],
    [1_000_000, "million"],
    [1000, "thousand"],
  ];
  const parts: string[] = [];
  for (const [size, word] of scales) {
    const count = Math.floor(n / size);
    if (count > 0) parts.push(`${enBelow1000(count)} ${word}`);
    n %= size;
  }
  if (n > 0) parts.push(enBelow1000(n));
  return parts.join(" ");
}
