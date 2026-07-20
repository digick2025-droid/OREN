/**
 * Service WhatsApp — prépare uniquement le lien wa.me.
 * Aucune API WhatsApp Business dans le MVP.
 */

import { formatAmount } from "@/lib/format";
import type { Lang } from "@/lib/i18n/config";
import type { DocumentRow } from "@/types/database";

const STRINGS: Record<
  Lang,
  {
    hello: string;
    hereIs: string;
    quote: string;
    invoice: string;
    amount: string;
    viewDoc: string;
  }
> = {
  fr: {
    hello: "Bonjour",
    hereIs: "Voici",
    quote: "votre devis",
    invoice: "votre facture",
    amount: "Montant",
    viewDoc: "Document à consulter",
  },
  en: {
    hello: "Hello",
    hereIs: "Here is",
    quote: "your quote",
    invoice: "your invoice",
    amount: "Amount",
    viewDoc: "Document",
  },
};

/**
 * Indicatif pays par défaut (Cameroun) appliqué aux numéros saisis en
 * format local. wa.me exige le numéro complet AVEC indicatif : un numéro
 * local (ex. « 6 90 00 00 00 ») sans indicatif produit un lien que
 * WhatsApp ne peut pas ouvrir.
 */
const DEFAULT_COUNTRY_CODE = "237";

/**
 * Met un numéro au format international requis par wa.me (chiffres seuls,
 * indicatif inclus, sans « + »).
 * - « +237 6XX… » / « 00237 6XX… » → déjà international, on garde l'indicatif.
 * - « 237XXXXXXXXX »               → indicatif déjà présent, inchangé.
 * - « 6 90 00 00 00 » (local)      → on préfixe l'indicatif par défaut.
 */
export function toInternationalPhone(
  phone: string,
  countryCode: string = DEFAULT_COUNTRY_CODE,
): string {
  const raw = phone.trim();
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  if (raw.startsWith("+")) return digits; // déjà E.164 (ex. +33…)
  if (digits.startsWith("00")) return digits.slice(2); // préfixe international 00
  if (digits.startsWith(countryCode)) return digits; // indicatif déjà présent
  const national = digits.replace(/^0+/, ""); // retire le 0 de tête national
  return countryCode + national;
}

export function buildWhatsAppLink(phone: string, message: string): string {
  const digits = toInternationalPhone(phone);
  const encoded = encodeURIComponent(message);
  return digits.length > 0
    ? `https://wa.me/${digits}?text=${encoded}`
    : `https://wa.me/?text=${encoded}`;
}

export function buildDocumentMessage(
  doc: Pick<DocumentRow, "type" | "number" | "title" | "total" | "client_name">,
  companyName: string,
  lang: Lang = "fr",
  /** URL signée du document déposé dans Supabase Storage, si disponible. */
  documentUrl?: string | null,
): string {
  const s = STRINGS[lang];
  const kind = doc.type === "facture" ? s.invoice : s.quote;
  const title = doc.title ? ` — ${doc.title}` : "";
  const lines = [
    `${s.hello} ${doc.client_name || ""}`.trim() + ",",
    "",
    `${s.hereIs} ${kind} ${doc.number}${title}.`,
    `${s.amount} : ${formatAmount(doc.total)}.`,
  ];
  if (documentUrl) {
    lines.push("", `${s.viewDoc} : ${documentUrl}`);
  }
  lines.push("", `${companyName}`);
  return lines.join("\n");
}

export function buildDocumentShareLink(
  doc: Pick<
    DocumentRow,
    "type" | "number" | "title" | "total" | "client_name" | "client_phone"
  >,
  companyName: string,
  lang: Lang = "fr",
  /** URL signée du document, ajoutée au message si fournie. */
  documentUrl?: string | null,
): string {
  return buildWhatsAppLink(
    doc.client_phone,
    buildDocumentMessage(doc, companyName, lang, documentUrl),
  );
}
