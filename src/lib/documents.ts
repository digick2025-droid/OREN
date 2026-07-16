/**
 * Logique documentaire pure — miroir TypeScript des règles appliquées
 * en base par convert_document_to_invoice (testée unitairement).
 */

import type { DocumentItem, DocumentRow } from "@/types/database";

export interface ConvertedInvoice {
  type: "facture";
  status: "brouillon";
  number: string;
  title: string;
  client_id: string | null;
  client_name: string;
  client_phone: string;
  subtotal: number;
  discount: number;
  vat_enabled: boolean;
  vat_rate: number;
  vat_amount: number;
  total: number;
  note: string;
  conditions: string;
  converted_from: string;
  items: Array<
    Pick<DocumentItem, "position" | "name" | "unit" | "quantity" | "unit_price" | "line_total">
  >;
}

/**
 * Convertit un devis en facture : nouveau numéro FAC-, statut brouillon,
 * totaux et lignes conservés à l'identique, lien vers le devis d'origine.
 */
export function buildConvertedInvoice(
  quote: DocumentRow,
  items: DocumentItem[],
  invoiceNumber: string,
): ConvertedInvoice {
  if (quote.type !== "devis") {
    throw new Error("NOT_A_QUOTE");
  }
  return {
    type: "facture",
    status: "brouillon",
    number: invoiceNumber,
    title: quote.title,
    client_id: quote.client_id,
    client_name: quote.client_name,
    client_phone: quote.client_phone,
    subtotal: quote.subtotal,
    discount: quote.discount,
    vat_enabled: quote.vat_enabled,
    vat_rate: quote.vat_rate,
    vat_amount: quote.vat_amount,
    total: quote.total,
    note: quote.note,
    conditions: quote.conditions,
    converted_from: quote.id,
    items: items.map((item) => ({
      position: item.position,
      name: item.name,
      unit: item.unit,
      quantity: item.quantity,
      unit_price: item.unit_price,
      line_total: item.line_total,
    })),
  };
}
