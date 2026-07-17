/**
 * Service WhatsApp — prépare uniquement le lien wa.me.
 * Aucune API WhatsApp Business dans le MVP.
 */

import { formatAmount } from "@/lib/format";
import type { Lang } from "@/lib/i18n/config";
import type { DocumentRow } from "@/types/database";

const STRINGS: Record<
  Lang,
  { hello: string; hereIs: string; quote: string; invoice: string; amount: string }
> = {
  fr: {
    hello: "Bonjour",
    hereIs: "Voici",
    quote: "votre devis",
    invoice: "votre facture",
    amount: "Montant",
  },
  en: {
    hello: "Hello",
    hereIs: "Here is",
    quote: "your quote",
    invoice: "your invoice",
    amount: "Amount",
  },
};

function normalizePhone(phone: string): string {
  return phone.replace(/[^\d]/g, "");
}

export function buildWhatsAppLink(phone: string, message: string): string {
  const digits = normalizePhone(phone);
  const encoded = encodeURIComponent(message);
  return digits.length > 0
    ? `https://wa.me/${digits}?text=${encoded}`
    : `https://wa.me/?text=${encoded}`;
}

export function buildDocumentMessage(
  doc: Pick<DocumentRow, "type" | "number" | "title" | "total" | "client_name">,
  companyName: string,
  lang: Lang = "fr",
): string {
  const s = STRINGS[lang];
  const kind = doc.type === "facture" ? s.invoice : s.quote;
  const title = doc.title ? ` — ${doc.title}` : "";
  return [
    `${s.hello} ${doc.client_name || ""}`.trim() + ",",
    "",
    `${s.hereIs} ${kind} ${doc.number}${title}.`,
    `${s.amount} : ${formatAmount(doc.total)}.`,
    "",
    `${companyName}`,
  ].join("\n");
}

export function buildDocumentShareLink(
  doc: Pick<
    DocumentRow,
    "type" | "number" | "title" | "total" | "client_name" | "client_phone"
  >,
  companyName: string,
  lang: Lang = "fr",
): string {
  return buildWhatsAppLink(
    doc.client_phone,
    buildDocumentMessage(doc, companyName, lang),
  );
}
