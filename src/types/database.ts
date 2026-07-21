/**
 * Types des tables Supabase (miroir de supabase/migrations).
 * Régénérer via `supabase gen types typescript` quand le schéma évolue.
 *
 * Montants (`bigint` en base depuis la migration 0010) :
 * les colonnes monétaires — subtotal, discount, vat_amount, total,
 * advance_amount, unit_price, line_total, amount, price_fcfa,
 * per_document_price_fcfa — sont des `bigint` côté PostgreSQL (aucun
 * risque de dépassement sur de gros devis FCFA). Elles sont typées
 * `number` ici : les montants FCFA réels restent très en deçà de
 * Number.MAX_SAFE_INTEGER. Si supabase-js / PostgREST renvoie un
 * `bigint` sous forme de chaîne selon la configuration, la
 * normalisation est assurée au point de calcul par
 * `parseAmount` (src/lib/calculations.ts), qui accepte number | string.
 */

export type DocumentType = "devis" | "facture" | "proforma";
export type DocumentStatus =
  | "brouillon"
  | "envoye"
  | "accepte"
  | "refuse"
  | "paye";
export type CatalogItemType = "produit" | "prestation";
export type TaxRegime = "reel" | "synthetique" | "franchise";
export type PaymentMethod = "orange_money" | "mtn_momo" | "card";
export type PaymentStatus = "pending" | "succeeded" | "failed";
export type SubscriptionStatus = "active" | "past_due" | "canceled";

export interface Profile {
  id: string;
  phone: string | null;
  full_name: string | null;
  language: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface Company {
  id: string;
  owner_id: string;
  name: string;
  owner_name: string | null;
  phone: string | null;
  whatsapp: string | null;
  address: string | null;
  email: string | null;
  logo_url: string | null;
  slogan: string | null;
  color: string;
  rccm: string | null;
  nif: string | null;
  tax_regime: TaxRegime;
  vat_enabled: boolean;
  vat_rate: number;
  suspended_at: string | null;
  suspended_reason: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export type CompanyInsert = Partial<
  Omit<Company, "id" | "created_at" | "updated_at" | "deleted_at">
> &
  Pick<Company, "owner_id" | "name">;

export type CompanyUpdate = Partial<
  Omit<Company, "id" | "owner_id" | "created_at" | "updated_at">
>;

export interface Client {
  id: string;
  company_id: string;
  name: string;
  phone: string | null;
  address: string | null;
  email: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export type ClientInsert = Pick<Client, "company_id" | "name"> &
  Partial<Pick<Client, "phone" | "address" | "email">>;

export type ClientUpdate = Partial<
  Pick<Client, "name" | "phone" | "address" | "email" | "deleted_at">
>;

export interface CatalogItem {
  id: string;
  company_id: string;
  name: string;
  type: CatalogItemType;
  unit: string;
  unit_price: number;
  is_favorite: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export type CatalogItemInsert = Pick<
  CatalogItem,
  "company_id" | "name" | "unit_price"
> &
  Partial<Pick<CatalogItem, "type" | "unit" | "is_favorite">>;

export type CatalogItemUpdate = Partial<
  Pick<
    CatalogItem,
    "name" | "type" | "unit" | "unit_price" | "is_favorite" | "deleted_at"
  >
>;

export interface DocumentRow {
  id: string;
  company_id: string;
  client_id: string | null;
  type: DocumentType;
  number: string;
  status: DocumentStatus;
  title: string;
  issue_date: string;
  client_name: string;
  client_phone: string;
  subtotal: number;
  discount: number;
  vat_enabled: boolean;
  vat_rate: number;
  vat_amount: number;
  total: number;
  advance_amount: number;
  note: string;
  conditions: string;
  converted_from: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export type DocumentUpdate = Partial<
  Pick<DocumentRow, "status" | "deleted_at">
>;

export interface DocumentItem {
  id: string;
  document_id: string;
  position: number;
  name: string;
  unit: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

/** Fonctionnalités activables par offre (configurées en base) */
export type PlanFeature =
  | "catalog"
  | "reports"
  | "proforma"
  | "logo"
  | "advance";

/** Contenu marketing bilingue d'une offre (`plans.marketing`, migration 0021). */
export interface PlanMarketingContent {
  tag: string;
  audience: string;
  features: string[];
}

export interface PlanMarketing {
  fr: PlanMarketingContent;
  en: PlanMarketingContent;
}

export interface Plan {
  key: string;
  name: string;
  price_fcfa: number;
  monthly_quota: number | null;
  per_document_price_fcfa: number | null;
  features: PlanFeature[];
  marketing: PlanMarketing;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Subscription {
  id: string;
  company_id: string;
  plan_key: string;
  status: SubscriptionStatus;
  current_period_start: string;
  current_period_end: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface Payment {
  id: string;
  company_id: string | null;
  subscription_id: string | null;
  document_id: string | null;
  amount: number;
  currency: string;
  provider: string;
  method: PaymentMethod;
  status: PaymentStatus;
  reference: string;
  phone: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface ActivityLog {
  id: string;
  company_id: string | null;
  actor_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

/** Retour de la RPC get_usage */
export interface Usage {
  used: number;
  quota: number | null;
  plan_key: string;
  plan_name: string;
  features: PlanFeature[];
  quota_lifetime: boolean;
  period_end: string | null;
}

export interface DocumentLineInput {
  name: string;
  unit: string;
  quantity: number;
  unit_price: number;
}

/** Charge utile de la RPC create_document */
export interface CreateDocumentPayload {
  type: DocumentType;
  client_id: string | null;
  client_name?: string;
  client_phone?: string;
  title: string;
  note: string;
  conditions: string;
  discount: number;
  advance_amount?: number;
  /** 'brouillon' pour un document incomplet enregistré */
  status?: DocumentStatus;
  converted_from?: string;
  items: DocumentLineInput[];
}

/** Charge utile de la RPC update_document (édition) */
export interface UpdateDocumentPayload {
  client_id: string | null;
  client_name?: string;
  client_phone?: string;
  title: string;
  note: string;
  conditions: string;
  discount: number;
  advance_amount?: number;
  status?: DocumentStatus;
  items: DocumentLineInput[];
}
