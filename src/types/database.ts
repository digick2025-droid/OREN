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

import type { LineCategory } from "@/lib/calculations";
import type { Metier } from "@/lib/catalog-templates";
import type { PdfTemplateId } from "@/services/pdf/types";

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
  /** Dernière ouverture de l'application (migration 0031, relances push). */
  last_seen_at: string | null;
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
  /** Métier déclaré au premier document — pré-remplissage / suggestions (migration 0026). */
  metier: Metier | null;
  /** Modèle de document PDF (migration 0044). */
  pdf_template: PdfTemplateId;
  /** Services affichés en pied de document, 12 max (migration 0044). */
  doc_services: string[];
  /** Mention libre en pied de document (migration 0044). */
  doc_footer_note: string | null;
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

/**
 * OREN ENTREPRISE — comptes rattachés à une entreprise avec rôle
 * (migration 0037). Le propriétaire est toujours « gerant ».
 */
export type CompanyRole =
  | "gerant"
  | "dispatcheur"
  | "commercial"
  | "technicien"
  | "comptable";
export type MemberStatus = "active" | "suspended";
/** Un invité ne peut pas être « gerant » (contrainte company_invitations). */
export type InvitationRole = Exclude<CompanyRole, "gerant">;
export type InvitationStatus = "pending" | "accepted" | "revoked";

export interface CompanyMember {
  id: string;
  company_id: string;
  user_id: string;
  role: CompanyRole;
  status: MemberStatus;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface CompanyInvitation {
  id: string;
  company_id: string;
  phone: string;
  role: InvitationRole;
  status: InvitationStatus;
  invited_by: string | null;
  created_at: string;
  updated_at: string;
}

/** OREN ENTREPRISE — intervention / bon de travail (migration 0040). */
export type InterventionStatus =
  | "a_planifier"
  | "planifiee"
  | "en_cours"
  | "terminee"
  | "annulee";

export interface Intervention {
  id: string;
  company_id: string;
  /** Numéro OT-NNN posé à la création (migration 0047). */
  number: string | null;
  client_id: string | null;
  title: string;
  description: string;
  status: InterventionStatus;
  assigned_to: string | null;
  scheduled_at: string | null;
  address: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export type InterventionInsert = Pick<Intervention, "company_id" | "title"> &
  Partial<
    Pick<
      Intervention,
      | "client_id"
      | "description"
      | "status"
      | "assigned_to"
      | "scheduled_at"
      | "address"
      | "created_by"
    >
  >;

export type InterventionUpdate = Partial<
  Pick<
    Intervention,
    | "client_id"
    | "title"
    | "description"
    | "status"
    | "assigned_to"
    | "scheduled_at"
    | "address"
    | "deleted_at"
  >
>;

/** OREN ENTREPRISE — rapport d'intervention signé (migration 0046). */
export type InterventionPhotoKind = "before" | "after";

export interface InterventionPhoto {
  path: string;
  kind: InterventionPhotoKind;
}

export interface InterventionReport {
  id: string;
  company_id: string;
  intervention_id: string;
  /** Numéro RI-NNN posé à la création (migration 0047). */
  number: string | null;
  summary: string;
  photos: InterventionPhoto[];
  signature_path: string | null;
  signed_by: string;
  signed_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

/** Champs posés par l'app lors d'un upsert de rapport. */
export type InterventionReportUpsert = Pick<
  InterventionReport,
  "company_id" | "intervention_id"
> &
  Partial<
    Pick<
      InterventionReport,
      "summary" | "photos" | "signature_path" | "signed_by" | "signed_at"
    >
  >;

/** OREN ENTREPRISE — pièce détachée en magasin (migration 0048). */
export interface Part {
  id: string;
  company_id: string;
  name: string;
  reference: string;
  unit: string;
  unit_price: number;
  stock: number;
  low_stock_threshold: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export type PartInsert = Pick<Part, "company_id" | "name"> &
  Partial<
    Pick<Part, "reference" | "unit" | "unit_price" | "stock" | "low_stock_threshold">
  >;

export type PartUpdate = Partial<
  Pick<
    Part,
    "name" | "reference" | "unit" | "unit_price" | "stock" | "low_stock_threshold" | "deleted_at"
  >
>;

/** Pièce posée sur une intervention (snapshot du magasin, migration 0048). */
export interface InterventionPart {
  id: string;
  company_id: string;
  intervention_id: string;
  part_id: string | null;
  name: string;
  unit: string;
  unit_price: number;
  quantity: number;
  created_by: string | null;
  created_at: string;
}

export type InterventionPartInsert = Pick<
  InterventionPart,
  "company_id" | "intervention_id" | "name" | "quantity"
> &
  Partial<Pick<InterventionPart, "part_id" | "unit" | "unit_price">>;

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
  /** Description du chantier / projet (migration 0044). */
  description: string;
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
  /** Matériel/prestation (défaut), main d'œuvre ou transport (migration 0027). */
  category: LineCategory;
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
  | "advance"
  /** OREN ENTREPRISE — équipe & rôles (migrations 0037/0038). */
  | "members"
  /** OREN ENTREPRISE — gestion d'interventions / FSM (migration 0040). */
  | "interventions"
  /** OREN ENTREPRISE — pièces détachées & stock (migration 0048). */
  | "parts";

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
  /** Prix pour 7 jours (migration 0042) ; null = pas vendue à la semaine. */
  week_price_fcfa: number | null;
  features: PlanFeature[];
  marketing: PlanMarketing;
  sort_order: number;
  is_active: boolean;
  /** Prix avant bascule "toutes les offres gratuites" — null si pas en promo. */
  promo_price_snapshot_fcfa: number | null;
  promo_per_doc_snapshot_fcfa: number | null;
  /**
   * Quota avant bascule "tout gratuit". `monthly_quota` null étant légitime
   * (illimité), c'est le booléen — pas le snapshot — qui dit si l'offre est
   * basculée.
   */
  promo_quota_snapshot: number | null;
  promo_quota_snapshotted: boolean;
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

/** Un appareil abonné aux relances push (migration 0031). */
export interface PushSubscriptionRow {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  lang: string;
  user_agent: string | null;
  created_at: string;
  last_success_at: string | null;
  failure_count: number;
}

export type RelanceKindRow =
  | "inactivite"
  | "devis_en_attente"
  | "facture_impayee"
  | "compte_inacheve";

/** Journal des relances envoyées — sert de garde-fou anti-répétition. */
export interface RelanceLogRow {
  id: string;
  user_id: string;
  kind: RelanceKindRow;
  document_id: string | null;
  sent_at: string;
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
  /** Documents offerts ou achetés, consommés une fois le quota atteint. */
  credits: number;
}

/** Retour de la RPC get_referral_info */
export interface ReferralInfo {
  code: string;
  credits: number;
  referred_count: number;
  rewarded_count: number;
  was_referred: boolean;
}

export interface DocumentLineInput {
  name: string;
  unit: string;
  /** Optionnelle : la base par défaut sur `article` si absente. */
  category?: LineCategory;
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
  description?: string;
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
  description?: string;
  note: string;
  conditions: string;
  discount: number;
  advance_amount?: number;
  status?: DocumentStatus;
  items: DocumentLineInput[];
}
