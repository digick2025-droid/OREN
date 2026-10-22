/**
 * Mise en forme de l'entonnoir pour l'admin (données : admin_funnel_stats).
 * Fonctions pures, testées à part.
 */

import type { FunnelEvent } from "@/lib/analytics";

export interface FunnelStep {
  event: FunnelEvent;
  label: string;
}

export interface FunnelRow extends FunnelStep {
  devices: number;
  /** Part des appareils de la première étape, 0–100. */
  ofFirst: number;
  /** Passage depuis l'étape précédente, 0–100 ; null pour la première. */
  fromPrevious: number | null;
}

export const ACCOUNT_FUNNEL: FunnelStep[] = [
  { event: "landing_view", label: "Landing vue" },
  { event: "signup_view", label: "Inscription ouverte" },
  { event: "signup_completed", label: "Compte créé" },
  { event: "builder_opened", label: "Devis commencé" },
  { event: "document_generated", label: "Document généré" },
  { event: "document_shared", label: "Document envoyé" },
];

export const PAYMENT_FUNNEL: FunnelStep[] = [
  { event: "quota_blocked", label: "Quota atteint" },
  { event: "paywall_view", label: "Page de paiement vue" },
  { event: "payment_started", label: "Paiement envoyé" },
  { event: "payment_succeeded", label: "Paiement réussi" },
];

export const EXPRESS_FUNNEL: FunnelStep[] = [
  { event: "express_started", label: "Express ouvert" },
  { event: "express_preview", label: "Aperçu affiché" },
  { event: "express_done", label: "Document obtenu" },
];

const pct = (part: number, whole: number) =>
  whole > 0 ? Math.round((part / whole) * 100) : 0;

export function buildFunnel(
  steps: FunnelStep[],
  counts: Partial<Record<string, number>>,
): FunnelRow[] {
  const count = (step: FunnelStep | undefined) =>
    step ? (counts[step.event] ?? 0) : 0;
  const first = count(steps[0]);
  return steps.map((step, index) => {
    const devices = count(step);
    const previous = index > 0 ? count(steps[index - 1]) : null;
    return {
      ...step,
      devices,
      ofFirst: pct(devices, first),
      fromPrevious: previous === null ? null : pct(devices, previous),
    };
  });
}

/** « 45 s », « 1 min 35 s », « 2 h 05 min » ; « — » sans mesure. */
export function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null || !Number.isFinite(seconds)) return "—";
  const total = Math.max(0, Math.round(seconds));
  if (total < 60) return `${total} s`;
  if (total < 3600) {
    const m = Math.floor(total / 60);
    const s = total % 60;
    return s === 0 ? `${m} min` : `${m} min ${String(s).padStart(2, "0")} s`;
  }
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  return `${h} h ${String(m).padStart(2, "0")} min`;
}
