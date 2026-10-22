/**
 * Suivi du parcours (funnel) — voir migration 0038.
 *
 * Interne et sans donnée personnelle : un identifiant d'appareil aléatoire,
 * gardé dans le navigateur, relie la landing au premier devis envoyé (il
 * survit à l'inscription). Les propriétés se limitent à des valeurs
 * techniques (type de document, durée) — jamais de nom, email, téléphone
 * ni montant.
 *
 * `track` ne lève jamais d'erreur et n'attend rien : une mesure perdue ne
 * doit en aucun cas gêner l'utilisateur.
 */

import { createClient } from "@/lib/supabase/client";

export type FunnelEvent =
  | "landing_view"
  | "signup_view"
  | "signup_completed"
  | "builder_opened"
  | "quota_blocked"
  | "document_generated"
  | "document_shared"
  | "express_started"
  | "express_preview"
  | "express_done"
  | "express_to_signup";

type Props = Record<string, string | number | boolean>;

const ANON_KEY = "oren_anon_id";
/** Mémoire de session des événements « une fois par visite ». */
const ONCE_PREFIX = "oren_tracked_";

/** Identifiant aléatoire de l'appareil, créé au premier appel. */
export function getAnonId(): string | null {
  try {
    let id = localStorage.getItem(ANON_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(ANON_KEY, id);
    }
    return id;
  } catch {
    // Stockage indisponible (navigation privée stricte) : pas de mesure.
    return null;
  }
}

export function track(event: FunnelEvent, props: Props = {}): void {
  if (typeof window === "undefined") return;
  const anonId = getAnonId();
  if (!anonId) return;
  try {
    void createClient()
      .rpc("track_event", { p_event: event, p_anon_id: anonId, p_props: props })
      .then(
        () => undefined,
        () => undefined,
      );
  } catch {
    // Configuration Supabase absente : on ignore.
  }
}

/**
 * Comme `track`, mais au plus une fois par onglet : une vue de page
 * rechargée ou un composant remonté ne gonfle pas l'entonnoir.
 */
export function trackOnce(event: FunnelEvent, props: Props = {}): void {
  try {
    const key = `${ONCE_PREFIX}${event}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
  } catch {
    // Sans sessionStorage, on mesure quand même.
  }
  track(event, props);
}
