import { describe, expect, it } from "vitest";
import { buildConvertedInvoice } from "./documents";
import type { DocumentItem, DocumentRow } from "@/types/database";

const quote: DocumentRow = {
  id: "q-1",
  company_id: "c-1",
  client_id: "cl-1",
  type: "devis",
  number: "DEV-003",
  status: "accepte",
  title: "Réparation fuite",
  issue_date: "2026-07-01",
  client_name: "Jean Kouassi",
  client_phone: "+237 690 00 00 00",
  subtotal: 45000,
  discount: 5000,
  vat_enabled: true,
  vat_rate: 18,
  vat_amount: 7200,
  total: 47200,
  advance_amount: 0,
  note: "Travaux mardi",
  conditions: "Paiement 50% à la commande",
  converted_from: null,
  created_at: "2026-07-01T10:00:00Z",
  updated_at: "2026-07-01T10:00:00Z",
  deleted_at: null,
};

const items: DocumentItem[] = [
  {
    id: "i-1",
    document_id: "q-1",
    position: 0,
    name: "Tube PVC 20",
    unit: "mètre",
    category: "article",
    quantity: 8,
    unit_price: 2500,
    line_total: 20000,
    created_at: "",
    updated_at: "",
    deleted_at: null,
  },
  {
    id: "i-2",
    document_id: "q-1",
    position: 1,
    name: "Main d'œuvre",
    unit: "forfait",
    category: "main_oeuvre",
    quantity: 1,
    unit_price: 25000,
    line_total: 25000,
    created_at: "",
    updated_at: "",
    deleted_at: null,
  },
];

describe("buildConvertedInvoice — conversion devis → facture", () => {
  it("crée une facture brouillon avec un nouveau numéro", () => {
    const invoice = buildConvertedInvoice(quote, items, "FAC-001");
    expect(invoice.type).toBe("facture");
    expect(invoice.status).toBe("brouillon");
    expect(invoice.number).toBe("FAC-001");
  });

  it("conserve les totaux et la TVA à l'identique", () => {
    const invoice = buildConvertedInvoice(quote, items, "FAC-001");
    expect(invoice.subtotal).toBe(quote.subtotal);
    expect(invoice.discount).toBe(quote.discount);
    expect(invoice.vat_amount).toBe(quote.vat_amount);
    expect(invoice.total).toBe(quote.total);
  });

  it("copie toutes les lignes dans l'ordre", () => {
    const invoice = buildConvertedInvoice(quote, items, "FAC-001");
    expect(invoice.items).toHaveLength(2);
    expect(invoice.items[0]?.name).toBe("Tube PVC 20");
    expect(invoice.items[1]?.line_total).toBe(25000);
  });

  it("garde la trace du devis d'origine", () => {
    const invoice = buildConvertedInvoice(quote, items, "FAC-001");
    expect(invoice.converted_from).toBe("q-1");
  });

  it("refuse de convertir une facture", () => {
    const facture = { ...quote, type: "facture" as const };
    expect(() => buildConvertedInvoice(facture, items, "FAC-002")).toThrow(
      "NOT_A_QUOTE",
    );
  });
});
