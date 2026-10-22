"use client";

import { useEffect } from "react";
import { normalizeReferralCode, savePendingReferral } from "@/lib/referral";

/**
 * Mémorise le code de parrainage présent dans l'URL (`?ref=`), sur n'importe
 * quelle page d'entrée. Lit `window.location` plutôt que `useSearchParams` :
 * monté à la racine, il imposerait sinon une frontière Suspense à tout le site.
 */
export function ReferralCapture() {
  useEffect(() => {
    const code = normalizeReferralCode(
      new URLSearchParams(window.location.search).get("ref"),
    );
    if (code) savePendingReferral(code);
  }, []);

  return null;
}
