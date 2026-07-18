/**
 * Passerelle de paiement — interface remplaçable.
 *
 * Modèle : un paiement est d'abord *initié* (le fournisseur crée une
 * transaction et, pour du Mobile Money, pousse une demande USSD sur le
 * téléphone du client). La confirmation réelle arrive **plus tard** via un
 * webhook signé. Le webhook est la SEULE source de vérité : c'est lui qui
 * insère la ligne `payments` et applique le changement de plan — jamais la
 * réponse de l'endpoint d'initiation.
 *
 * Certains fournisseurs (ex. le simulateur du MVP) règlent de façon
 * synchrone : `initiate()` renvoie alors directement `status: "succeeded"`
 * et l'appelant peut confirmer immédiatement, sans attendre de webhook.
 *
 * NB : les types métier partagés (PaymentMethod, etc.) vivent dans
 * `@/types/database` et ne sont pas redéfinis ici.
 */

import type { PaymentMethod } from "@/types/database";

export type PaymentPurpose = "subscription" | "express_document";

/** État normalisé d'une transaction, indépendant du fournisseur. */
export type PaymentStatus = "pending" | "succeeded" | "failed";

/** Données transmises au fournisseur pour initier un paiement. */
export interface PaymentIntentInput {
  /** Référence interne unique (générée par OREN), corrèle init ⇆ webhook. */
  reference: string;
  /** Montant en FCFA (entier). */
  amount: number;
  /** Devise ISO (XAF par défaut). */
  currency: string;
  method: PaymentMethod;
  /** Numéro Mobile Money E.164 (requis pour orange_money / mtn_momo). */
  phone?: string;
  purpose: PaymentPurpose;
  /** Clé de l'offre (abonnement). */
  planKey?: string;
  metadata?: Record<string, string>;
}

/** Résultat de l'initiation (PAS la confirmation finale). */
export interface PaymentInitiation {
  /** L'initiation a-t-elle été acceptée par la passerelle ? */
  accepted: boolean;
  /**
   * "pending"   → attendre le webhook (cas nominal d'une vraie passerelle).
   * "succeeded" → réglé de façon synchrone (simulateur) : confirmer tout de suite.
   * "failed"    → refus immédiat.
   */
  status: PaymentStatus;
  /** Identifiant de transaction côté fournisseur (peut différer de `reference`). */
  providerReference: string;
  /** URL de paiement hébergé, si le fournisseur en fournit une. */
  redirectUrl?: string;
  /** Code d'erreur (initiation refusée). */
  error?: string;
}

export interface PaymentProvider {
  readonly name: string;
  initiate(input: PaymentIntentInput): Promise<PaymentInitiation>;
}

/**
 * Événement normalisé issu d'un webhook fournisseur, après vérification
 * de signature. C'est ce que le handler de webhook transmet à la couche
 * de confirmation.
 */
export interface PaymentWebhookEvent {
  /** Notre référence interne (celle passée à `initiate`). */
  reference: string;
  /** Référence côté fournisseur. */
  providerReference: string;
  status: PaymentStatus;
}

export type { PaymentMethod };
