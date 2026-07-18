/**
 * Moteur PDF — point d'entrée.
 * Rendu HTML A4 + impression/téléchargement via la boîte de dialogue
 * d'impression du navigateur (MVP). D'autres modèles s'ajoutent dans
 * le registre sans toucher au reste de l'application.
 */

import type { Company, DocumentItem, DocumentRow } from "@/types/database";
import { PDF_STRINGS } from "./strings";
import { classicTemplate } from "./templates/classic";
import type {
  PdfCompany,
  PdfDocumentData,
  PdfLang,
  PdfTemplate,
  PdfTemplateId,
} from "./types";

const TEMPLATES: Record<PdfTemplateId, PdfTemplate> = {
  classic: classicTemplate,
};

export function renderDocumentHtml(
  doc: PdfDocumentData,
  company: PdfCompany,
  lang: PdfLang = "fr",
  templateId: PdfTemplateId = "classic",
): string {
  return TEMPLATES[templateId].render(doc, company, PDF_STRINGS[lang]);
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
    advanceAmount: doc.advance_amount,
    note: doc.note,
    conditions: doc.conditions,
  };
}

export function toPdfCompany(
  company: Company,
  options?: { premiumBranding?: boolean },
): PdfCompany {
  return {
    name: company.name,
    ownerName: company.owner_name ?? "",
    slogan: company.slogan ?? "",
    phone: company.phone ?? "",
    whatsapp: company.whatsapp ?? "",
    address: company.address ?? "",
    email: company.email ?? "",
    logoUrl: company.logo_url ?? "",
    color: company.color,
    rccm: company.rccm ?? "",
    nif: company.nif ?? "",
    taxRegime: company.tax_regime,
    premiumBranding: options?.premiumBranding ?? false,
  };
}

/**
 * Imprime le document (téléchargement A4 via « Imprimer → PDF »)
 * dans une iframe cachée : aucune fenêtre pop-up, donc jamais bloqué.
 */
export function printDocument(html: string): boolean {
  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  iframe.srcdoc = html;
  iframe.onload = () => {
    // Laisse le temps aux styles de se charger avant l'impression
    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      // Nettoyage une fois la boîte de dialogue refermée
      setTimeout(() => iframe.remove(), 60_000);
    }, 300);
  };
  document.body.appendChild(iframe);
  return true;
}

export type {
  PdfCompany,
  PdfDocumentData,
  PdfLang,
  PdfTemplateId,
} from "./types";
