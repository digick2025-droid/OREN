/**
 * Moteur PDF — point d'entrée.
 * Rendu HTML A4 + impression/téléchargement via la boîte de dialogue
 * d'impression du navigateur (MVP). D'autres modèles s'ajoutent dans
 * le registre sans toucher au reste de l'application.
 */

import type { Company, DocumentItem, DocumentRow } from "@/types/database";
import { classicTemplate } from "./templates/classic";
import type {
  PdfCompany,
  PdfDocumentData,
  PdfTemplate,
  PdfTemplateId,
} from "./types";

const TEMPLATES: Record<PdfTemplateId, PdfTemplate> = {
  classic: classicTemplate,
};

export function renderDocumentHtml(
  doc: PdfDocumentData,
  company: PdfCompany,
  templateId: PdfTemplateId = "classic",
): string {
  return TEMPLATES[templateId].render(doc, company);
}

/** Adapte les lignes Supabase vers les données du moteur PDF. */
export function toPdfData(
  doc: DocumentRow,
  items: DocumentItem[],
): PdfDocumentData {
  return {
    type: doc.type,
    number: doc.number,
    title: doc.title,
    issueDate: doc.issue_date,
    clientName: doc.client_name,
    clientPhone: doc.client_phone,
    lines: items.map((item) => ({
      name: item.name,
      unit: item.unit,
      quantity: item.quantity,
      unitPrice: item.unit_price,
      lineTotal: item.line_total,
    })),
    subtotal: doc.subtotal,
    discount: doc.discount,
    vatRate: doc.vat_enabled ? doc.vat_rate : 0,
    vatAmount: doc.vat_amount,
    total: doc.total,
    note: doc.note,
    conditions: doc.conditions,
  };
}

export function toPdfCompany(company: Company): PdfCompany {
  return {
    name: company.name,
    ownerName: company.owner_name ?? "",
    phone: company.phone ?? "",
    whatsapp: company.whatsapp ?? "",
    address: company.address ?? "",
    email: company.email ?? "",
    logoUrl: company.logo_url ?? "",
    color: company.color,
    rccm: company.rccm ?? "",
    nif: company.nif ?? "",
    taxRegime: company.tax_regime,
  };
}

/**
 * Ouvre le document dans une fenêtre d'impression (téléchargement A4).
 * Retourne false si le navigateur a bloqué la fenêtre pop-up.
 */
export function printDocument(html: string): boolean {
  const win = window.open("", "_blank");
  if (!win) return false;
  win.document.write(html);
  win.document.close();
  win.focus();
  // Laisse le temps aux polices/styles de se charger avant l'impression
  setTimeout(() => {
    win.print();
  }, 350);
  return true;
}

export type { PdfCompany, PdfDocumentData, PdfTemplateId } from "./types";
