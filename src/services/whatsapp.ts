/**
 * Service WhatsApp — prépare uniquement le lien wa.me.
 * Aucune API WhatsApp Business dans le MVP.
 */

import { formatAmount } from "@/lib/format";
import type { DocumentRow } from "@/types/database";

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
): string {
  const kind = doc.type === "facture" ? "votre facture" : "votre devis";
  const title = doc.title ? ` — ${doc.title}` : "";
  return [
    `Bonjour ${doc.client_name || ""}`.trim() + ",",
    "",
    `Voici ${kind} ${doc.number}${title}.`,
    `Montant : ${formatAmount(doc.total)}.`,
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
): string {
  return buildWhatsAppLink(
    doc.client_phone,
    buildDocumentMessage(doc, companyName),
  );
}
