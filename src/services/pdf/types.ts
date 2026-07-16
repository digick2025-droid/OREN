/**
 * Moteur PDF — types indépendants du reste de l'application.
 * Le moteur ne connaît ni Supabase ni React : il reçoit des données
 * et rend un document A4. D'autres modèles pourront être ajoutés.
 */

export interface PdfCompany {
  name: string;
  ownerName: string;
  phone: string;
  whatsapp: string;
  address: string;
  email: string;
  logoUrl: string;
  color: string;
  rccm: string;
  nif: string;
  taxRegime: string;
}

export interface PdfLine {
  name: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface PdfDocumentData {
  type: "devis" | "facture";
  number: string;
  title: string;
  issueDate: string;
  clientName: string;
  clientPhone: string;
  lines: PdfLine[];
  subtotal: number;
  discount: number;
  vatRate: number;
  vatAmount: number;
  total: number;
  note: string;
  conditions: string;
}

export type PdfTemplateId = "classic";

export interface PdfTemplate {
  id: PdfTemplateId;
  /** Rend le document complet en HTML A4 autonome (styles inline) */
  render(doc: PdfDocumentData, company: PdfCompany): string;
}
