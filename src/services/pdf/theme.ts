/**
 * Briques partagées par les modèles PDF : formatage, thème couleur
 * dérivé de la couleur de marque (lisibilité garantie quelle que soit
 * la couleur choisie ou extraite du logo), logo, blocs communs.
 *
 * Tout est pur (aucun DOM) : le rendu reste une simple chaîne HTML.
 */

import { numberToEnglishWords, numberToFrenchWords } from "./amount-words";
import type {
  PdfCompany,
  PdfDocumentData,
  PdfLine,
  PdfLineCategory,
  PdfStrings,
} from "./types";

// ------------------------------------------------------------------
// Formatage
// ------------------------------------------------------------------

export function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function fcfa(value: number): string {
  return (
    Math.round(value || 0)
      .toLocaleString("fr-FR")
      .replace(/[  ]/g, " ") + " FCFA"
  );
}

export function frDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

// ------------------------------------------------------------------
// Couleurs
// ------------------------------------------------------------------

const DEFAULT_BRAND = "#0F172A";
const DARK_TEXT = "#0F172A";

/** `#RGB` ou `#RRGGBB` → `#RRGGBB` ; toute autre valeur → couleur par défaut. */
export function normalizeHex(hex: string): string {
  const value = (hex || "").trim();
  if (/^#[0-9a-fA-F]{6}$/.test(value)) return value.toUpperCase();
  if (/^#[0-9a-fA-F]{3}$/.test(value)) {
    const [r, g, b] = value.slice(1);
    return `#${r}${r}${g}${g}${b}${b}`.toUpperCase();
  }
  return DEFAULT_BRAND;
}

function toRgb(hex: string): [number, number, number] {
  const n = parseInt(normalizeHex(hex).slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function toHex([r, g, b]: [number, number, number]): string {
  return `#${[r, g, b]
    .map((c) => Math.round(Math.min(255, Math.max(0, c))).toString(16).padStart(2, "0"))
    .join("")}`.toUpperCase();
}

/** Luminance relative WCAG (0 = noir, 1 = blanc). */
export function luminance(hex: string): number {
  const linear = (c: number) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  const [r, g, b] = toRgb(hex);
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

/** Rapport de contraste WCAG entre deux couleurs (1 à 21). */
export function contrast(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Mélange `hex` vers `target` (0 = inchangé, 1 = target). */
function mix(hex: string, target: string, amount: number): string {
  const [ar, ag, ab] = toRgb(hex);
  const [br, bg, bb] = toRgb(target);
  return toHex([
    ar + (br - ar) * amount,
    ag + (bg - ag) * amount,
    ab + (bb - ab) * amount,
  ]);
}

/** Couleur avec transparence, en rgba() (rendu fiable par html2canvas). */
export function rgba(hex: string, alpha: number): string {
  const [r, g, b] = toRgb(hex);
  return `rgba(${r},${g},${b},${alpha})`;
}

export interface PdfTheme {
  /** Couleur de marque brute : aplats (bandeaux, en-tête du tableau, total). */
  brand: string;
  /** Texte posé sur `brand` : blanc ou sombre selon le contraste. */
  onBrand: string;
  /** Variante lisible sur fond blanc (contraste ≥ 4,5) : titres, libellés. */
  ink: string;
  /** Fond très léger (~6 %). */
  soft: string;
  /** Bordure légère (~22 %). */
  softBorder: string;
  /** Second ton du dégradé de marque. */
  brandAlt: string;
}

export function buildTheme(color: string): PdfTheme {
  const brand = normalizeHex(color);

  // Le blanc reste préféré tant qu'il est lisible (contraste ≥ 3, texte gras).
  const onBrand = contrast("#FFFFFF", brand) >= 3 ? "#FFFFFF" : DARK_TEXT;

  let ink = brand;
  for (let step = 1; contrast(ink, "#FFFFFF") < 4.5 && step <= 10; step++) {
    ink = mix(brand, "#000000", step * 0.08);
  }

  return {
    brand,
    onBrand,
    ink,
    soft: rgba(brand, 0.06),
    softBorder: rgba(brand, 0.22),
    brandAlt:
      luminance(brand) > 0.5 ? mix(brand, "#000000", 0.12) : mix(brand, "#FFFFFF", 0.18),
  };
}

// ------------------------------------------------------------------
// Logo
// ------------------------------------------------------------------

/**
 * Logo en image de fond « contain » : html2canvas (export PDF) ignore
 * object-fit et étirerait un logo non carré.
 */
export function logoBackground(url: string, position = "left center"): string {
  return `background:url('${esc(url).replace(/'/g, "%27")}') ${position}/contain no-repeat`;
}

/**
 * Boîte de logo adaptée à sa forme sans connaître son ratio : largeur
 * maximale + hauteur fixe, image en « contain ». Un logo horizontal
 * remplit la largeur, un logo carré reste compact.
 */
export function logoBox(
  url: string,
  { width, height, align = "left" }: { width: number; height: number; align?: "left" | "center" | "right" },
): string {
  return `<div style="width:${width}px;height:${height}px;flex-shrink:0;${logoBackground(url, `${align} center`)}"></div>`;
}

/** Initiale de l'entreprise quand aucun logo n'est chargé. */
export function monogram(name: string, theme: PdfTheme, size = 52): string {
  return `<div style="width:${size}px;height:${size}px;flex-shrink:0;border-radius:${Math.round(size / 4.3)}px;background:linear-gradient(135deg,${theme.brand},${theme.brandAlt});color:${theme.onBrand};display:flex;align-items:center;justify-content:center;font-size:${Math.round(size * 0.42)}px;font-weight:800">${esc((name || "D").charAt(0).toUpperCase())}</div>`;
}

// ------------------------------------------------------------------
// Données communes
// ------------------------------------------------------------------

export function titleWord(doc: PdfDocumentData, s: PdfStrings): string {
  return doc.type === "facture" ? s.invoice : doc.type === "proforma" ? s.proforma : s.quote;
}

export function legalBits(company: PdfCompany, s: PdfStrings): string {
  return [
    company.rccm ? `RCCM ${esc(company.rccm)}` : "",
    company.nif ? `NIF ${esc(company.nif)}` : "",
    company.taxRegime ? `${s.regime} ${esc(company.taxRegime)}` : "",
  ]
    .filter(Boolean)
    .join(" · ");
}

export function contactLines(company: PdfCompany): string[] {
  return [company.address, company.phone, company.email].filter(Boolean).map(esc);
}

const CATEGORY_RANK: Record<PdfLineCategory, number> = {
  article: 0,
  main_oeuvre: 1,
  transport: 2,
};

/**
 * Matériel/prestation avant main d'œuvre avant transport, ordre stable
 * au sein d'une même catégorie.
 */
export function sortedLines(doc: PdfDocumentData): PdfLine[] {
  return [...doc.lines].sort(
    (a, b) => CATEGORY_RANK[a.category ?? "article"] - CATEGORY_RANK[b.category ?? "article"],
  );
}

export interface TotalRow {
  label: string;
  value: string;
  minus?: boolean;
  /** Séparateur pointillé après la ligne (fin des sous-totaux par catégorie). */
  separatorAfter?: boolean;
}

export interface TotalsData {
  /** Lignes avant le total (catégories, sous-total, remise, TVA). */
  rows: TotalRow[];
  totalLabel: string;
  total: string;
  /** Acompte (ligne en moins) — absent sans acompte. */
  advance: TotalRow | null;
  /** Reste à payer — absent sans acompte. */
  remaining: TotalRow | null;
  /** Mention « TVA non applicable » si la TVA est à 0. */
  vatNa: string;
}

export function buildTotals(doc: PdfDocumentData, s: PdfStrings): TotalsData {
  const cat = doc.lines.reduce<Record<PdfLineCategory, number>>(
    (acc, line) => {
      acc[line.category ?? "article"] += line.lineTotal;
      return acc;
    },
    { article: 0, main_oeuvre: 0, transport: 0 },
  );
  const rows: TotalRow[] = [];
  if (cat.main_oeuvre > 0 || cat.transport > 0) {
    const catRows: TotalRow[] = [{ label: s.catArticleTotal, value: fcfa(cat.article) }];
    if (cat.main_oeuvre > 0) catRows.push({ label: s.catMainOeuvreTotal, value: fcfa(cat.main_oeuvre) });
    if (cat.transport > 0) catRows.push({ label: s.catTransportTotal, value: fcfa(cat.transport) });
    catRows[catRows.length - 1]!.separatorAfter = true;
    rows.push(...catRows);
  }
  rows.push({ label: s.subtotal, value: fcfa(doc.subtotal) });
  if (doc.discount > 0) rows.push({ label: s.discount, value: fcfa(doc.discount), minus: true });
  if (doc.vatRate > 0) {
    rows.push({ label: s.netAmount, value: fcfa(doc.subtotal - doc.discount) });
    rows.push({ label: `${s.vat} ${doc.vatRate}%`, value: fcfa(doc.vatAmount) });
  }
  const hasAdvance = doc.advanceAmount > 0;
  return {
    rows,
    totalLabel: doc.vatRate > 0 ? s.totalTtc : s.total,
    total: fcfa(doc.total),
    advance: hasAdvance ? { label: s.advance, value: fcfa(doc.advanceAmount), minus: true } : null,
    remaining: hasAdvance
      ? { label: s.remaining, value: fcfa(Math.max(doc.total - doc.advanceAmount, 0)) }
      : null,
    vatNa: doc.vatRate === 0 ? s.vatNa : "",
  };
}

/** Ligne de total standard (libellé à gauche, montant à droite). */
export function totalRowHtml(row: TotalRow, color = "#475569"): string {
  const line = `<div style="display:flex;justify-content:space-between;font-size:12px;color:${color};padding:4px 0"><span>${row.label}</span><span style="font-variant-numeric:tabular-nums">${row.minus ? "− " : ""}${row.value}</span></div>`;
  return row.separatorAfter
    ? `${line}<div style="border-top:1px dashed #E2E8F0;margin:4px 0"></div>`
    : line;
}

// ------------------------------------------------------------------
// Blocs communs
// ------------------------------------------------------------------

/** Petit libellé en capitales espacées. */
export function eyebrow(text: string, color: string): string {
  return `<div style="font-size:8.5px;font-weight:700;color:${color};text-transform:uppercase;letter-spacing:.09em">${text}</div>`;
}

/** Description du chantier / projet — rien si vide. */
export function descriptionBlock(doc: PdfDocumentData, theme: PdfTheme, s: PdfStrings): string {
  const text = doc.description?.trim();
  if (!text) return "";
  return `<div style="margin-bottom:16px;padding:10px 14px;border:1px solid #E2E8F0;border-radius:10px">
    ${eyebrow(s.projectDescription, theme.ink)}
    <div style="font-size:11.5px;color:#334155;line-height:1.6;margin-top:4px;white-space:pre-line">${esc(text)}</div>
  </div>`;
}

/** Conditions + note libre. */
export function conditionsAndNote(doc: PdfDocumentData, theme: PdfTheme, s: PdfStrings): string {
  const conditions = doc.conditions
    ? `<div style="margin-top:16px">${eyebrow(s.conditions, theme.ink)}<div style="font-size:11px;color:#475569;margin-top:4px;line-height:1.55;white-space:pre-line">${esc(doc.conditions)}</div></div>`
    : "";
  const note = doc.note
    ? `<div style="margin-top:10px;font-size:11px;color:#475569;line-height:1.55;white-space:pre-line">${esc(doc.note)}</div>`
    : "";
  return conditions + note;
}

/**
 * Pied de page personnalisé : services de l'entreprise en pastilles,
 * puis mention libre. Rien si les deux sont vides.
 */
export function servicesFooter(company: PdfCompany, theme: PdfTheme, s: PdfStrings): string {
  const services = (company.services ?? []).map((v) => v.trim()).filter(Boolean);
  const note = company.footerNote?.trim() ?? "";
  if (services.length === 0 && !note) return "";
  const chips = services
    .map(
      (service) =>
        `<span style="display:inline-block;font-size:9.5px;font-weight:600;color:${theme.ink};background:${theme.soft};border:1px solid ${theme.softBorder};border-radius:999px;padding:2px 9px;margin:0 4px 4px 0">${esc(service)}</span>`,
    )
    .join("");
  return `<div style="margin-top:18px;padding-top:10px;border-top:1px solid #E2E8F0">
    ${
      services.length > 0
        ? `<div style="display:flex;align-items:flex-start;gap:10px"><div style="flex-shrink:0;padding-top:3px">${eyebrow(s.services, theme.ink)}</div><div style="flex:1">${chips}</div></div>`
        : ""
    }
    ${note ? `<div style="font-size:9.5px;color:#64748B;line-height:1.5;margin-top:${services.length > 0 ? 2 : 0}px">${esc(note)}</div>` : ""}
  </div>`;
}

/** Zone signatures (bon pour accord client hors facture + signature entreprise). */
export function signatures(doc: PdfDocumentData, company: PdfCompany, s: PdfStrings): string {
  const line = `<div style="width:150px;border-bottom:1.5px solid #CBD5E1;height:44px"></div>`;
  const accord =
    doc.type !== "facture"
      ? `<div style="text-align:center"><div style="font-size:9.5px;font-weight:700;color:#94A3B8;text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px">${s.approval}</div>${line}<div style="font-size:9.5px;color:#64748B;margin-top:5px">${s.approvalDate}</div></div>`
      : "";
  return `${accord}<div style="text-align:center">${line}<div style="font-size:9.5px;color:#64748B;margin-top:5px">${esc(company.ownerName || company.name)} · ${s.signature}</div></div>`;
}

/** Bas de document : mentions légales à gauche, signatures à droite. */
export function legalAndSignatures(
  doc: PdfDocumentData,
  company: PdfCompany,
  s: PdfStrings,
  vatNa: string,
): string {
  const legal = legalBits(company, s);
  return `<div style="display:flex;justify-content:space-between;align-items:flex-end;padding-top:14px;gap:20px">
    <div style="flex:1;font-size:9.5px;color:#94A3B8;line-height:1.6">
      <div>${doc.type === "facture" ? s.latePenalty : s.quoteValidity}</div>
      ${legal ? `<div style="margin-top:4px;font-weight:600;color:#64748B">${legal}</div>` : ""}
      ${vatNa ? `<div style="font-size:10px;color:#94A3B8;font-style:italic;margin-top:6px">${vatNa}</div>` : ""}
    </div>
    ${signatures(doc, company, s)}
  </div>`;
}

/**
 * « Arrêté le présent devis à la somme de … » : le total en toutes
 * lettres, comme l'exige l'usage (OHADA) sur devis, proformas et factures.
 */
export function amountStatement(doc: PdfDocumentData, s: PdfStrings): string {
  const words = (s.locale === "en" ? numberToEnglishWords : numberToFrenchWords)(doc.total);
  const label =
    doc.type === "facture"
      ? s.amountStatementInvoice
      : doc.type === "proforma"
        ? s.amountStatementProforma
        : s.amountStatementQuote;
  return `<div style="margin-top:14px;font-size:11px;color:#334155;line-height:1.55">${label} : <strong style="color:#0F172A">${esc(words.charAt(0).toUpperCase() + words.slice(1))} ${s.currencyWords}</strong> (${fcfa(doc.total)}).</div>`;
}

/**
 * Pied de page final. Offre avec logo : à l'image de l'entreprise, sans
 * aucune mention OREN (avantage payant). Offre payante sans logo : rien.
 * Sinon : « Créé avec OREN » et le lien d'inscription — chaque devis
 * envoyé fait connaître OREN, et le lien de parrainage récompense
 * l'artisan qui l'a envoyé.
 */
export function brandFooter(company: PdfCompany, theme: PdfTheme, s: PdfStrings, branded: boolean): string {
  if (branded) {
    return `<div style="display:flex;align-items:center;gap:8px;border-top:1px solid #E2E8F0;margin-top:14px;padding-top:10px">
      ${logoBox(company.logoUrl, { width: 40, height: 18 })}
      <span style="font-size:9.5px;font-weight:700;color:#0F172A">${esc(company.name)}</span>
      ${company.slogan ? `<span style="font-size:9px;color:#94A3B8">· ${esc(company.slogan)}</span>` : ""}
    </div>`;
  }
  if (company.premiumBranding) return "";
  const signupUrl = (company.signupUrl ?? "").replace(/^https?:\/\//, "");
  return `<div style="text-align:center;border-top:1px solid #E2E8F0;margin-top:14px;padding-top:10px;line-height:1.5">
    <div style="font-size:10px;font-weight:700;color:#475569">${s.footer}</div>
    ${signupUrl ? `<div style="font-size:9.5px;color:#64748B">${s.footerCta} <span style="font-weight:700;color:${theme.ink}">${esc(signupUrl)}</span></div>` : ""}
  </div>`;
}

/**
 * Bas du document, poussé en bas de page : mentions + signatures,
 * services, pied de page. Un seul enfant de `.content`, donc un seul
 * bloc insécable pour la pagination : jamais de bande de pied de page
 * isolée sur une page à part.
 *
 * L'espaceur flexible (≥ 12 px) qui le précède remplace un
 * `margin-top:auto` : la pagination coupe 2 px au-dessus d'un bloc, et
 * sans vide entre les deux, la coupe mordait sur le texte précédent.
 */
export function documentEnd(
  doc: PdfDocumentData,
  company: PdfCompany,
  theme: PdfTheme,
  s: PdfStrings,
  vatNa: string,
  branded: boolean,
): string {
  return `<div style="flex:1 0 12px"></div>
  <div>
    ${legalAndSignatures(doc, company, s, vatNa)}
    ${servicesFooter(company, theme, s)}
    ${brandFooter(company, theme, s, branded)}
  </div>`;
}

/** Filigrane du logo, très léger, centré (offre avec branding). */
export function watermark(company: PdfCompany, branded: boolean): string {
  if (!branded) return "";
  return `<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;z-index:0;pointer-events:none">
    <div style="width:105mm;height:105mm;opacity:.045;${logoBackground(company.logoUrl, "center")}"></div>
  </div>`;
}

/**
 * Police Inter de l'application (fichier variable, sous-ensemble latin :
 * accents français, œ, €), servie par le site lui-même — la CSP
 * n'autorise que `font-src 'self'`. Chemin relatif : il se résout depuis
 * l'iframe de capture et l'aperçu (URL de base héritée de l'application) ;
 * l'onglet d'aperçu en blob: reçoit un <base> (voir index.ts).
 */
export const PDF_FONT_URL = "/fonts/inter-latin.woff2";

/**
 * Squelette HTML A4. Les classes `.page` et `.content` (et les `thead` /
 * `tbody tr` du tableau) servent de repères à la pagination de generate.ts.
 */
export function pageShell(
  title: string,
  body: string,
  { padding = "16mm 15mm 12mm", verticalPaddingMm = 28 }: { padding?: string; verticalPaddingMm?: number } = {},
): string {
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<title>${esc(title)}</title>
<style>
  @page { size: A4; margin: 0; }
  @font-face { font-family: 'Inter'; font-style: normal; font-weight: 100 900; font-display: block; src: url('${PDF_FONT_URL}') format('woff2'); }
  * { margin: 0; padding: 0; box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { font-family: 'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif; background: #fff; color: #0F172A; }
  .page { width: 210mm; min-height: 297mm; padding: ${padding}; margin: 0 auto; position: relative; }
  .content { position: relative; z-index: 1; display: flex; flex-direction: column; min-height: calc(297mm - ${verticalPaddingMm}mm); }
  tr { break-inside: avoid; page-break-inside: avoid; }
  @media print { .page { width: auto; min-height: auto; } .content { min-height: calc(297mm - ${verticalPaddingMm + 2}mm); } }
</style>
</head>
<body>
<div class="page">
${body}
</div>
</body>
</html>`;
}
