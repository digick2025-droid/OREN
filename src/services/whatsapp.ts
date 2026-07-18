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
