/**
 * Moteur PDF — types indépendants du reste de l'application.
 * Le moteur ne connaît ni Supabase ni React : il reçoit des données
 * et rend un document A4. D'autres modèles pourront être ajoutés.
 */

export interface PdfCompany {
  name: string;
  ownerName: string;
  slogan: string;
  phone: string;
  whatsapp: string;
  address: string;
  email: string;
  logoUrl: string;
  color: string;
  rccm: string;
  nif: string;
  taxRegime: string;
  /** Offre Startup : branding complet (filigrane, pied de page à l'image de l'entreprise) */
  premiumBranding: boolean;
}

export type PdfLineCategory = "article" | "main_oeuvre" | "transport";

export interface PdfLine {
  name: string;
  unit: string;
  /** Matériel/prestation (défaut), main d'œuvre ou transport. */
  category?: PdfLineCategory;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface PdfDocumentData {
  type: "devis" | "facture" | "proforma";
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
  advanceAmount: number;
  note: string;
  conditions: string;
}

export type PdfTemplateId = "classic";

export type PdfLang = "fr" | "en";

/** Libellés du document — le moteur reste indépendant de l'app */
export interface PdfStrings {
  quote: string;
  invoice: string;
  proforma: string;
  advance: string;
  remaining: string;
  date: string;
  client: string;
  designation: string;
  qty: string;
  unitPrice: string;
  total: string;
  totalTtc: string;
  catArticleTotal: string;
  catMainOeuvreTotal: string;
  catTransportTotal: string;
  subtotal: string;
  discount: string;
  netAmount: string;
  vat: string;
  vatNa: string;
  conditions: string;
  signature: string;
  approval: string;
  approvalDate: string;
  quoteValidity: string;
  latePenalty: string;
  regime: string;
  footer: string;
}

export interface PdfTemplate {
  id: PdfTemplateId;
  /** Rend le document complet en HTML A4 autonome (styles inline) */
  render(doc: PdfDocumentData, company: PdfCompany, strings: PdfStrings): string;
}
