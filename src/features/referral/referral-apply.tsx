"use client";

import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useCompany } from "@/features/company/company-context";
import { createClient } from "@/lib/supabase/client";
import { clearPendingReferral, readPendingReferral } from "@/lib/referral";

/**
 * Soumet le code de parrainage mémorisé dès que l'entreprise existe (monté
 * dans le layout authentifié). Seul le parrain est récompensé : le filleul ne
 * voit donc rien, et un refus (code inconnu, compte déjà actif…) n'est pas une
 * erreur à montrer — le code est simplement oublié.
 */
export function ReferralApply() {
  const company = useCompany();
  const queryClient = useQueryClient();
  const done = useRef(false);

  useEffect(() => {
    if (done.current) return;
    const code = readPendingReferral();
    if (!code) return;
    done.current = true;

    const supabase = createClient();
    void supabase.rpc("apply_referral", { p_code: code }).then(({ error }) => {
      // Raté réseau : on garde le code pour le prochain chargement.
      if (error) {
        done.current = false;
        return;
      }
      clearPendingReferral();
      void queryClient.invalidateQueries({ queryKey: ["referral", company.id] });
    });
  }, [company.id, queryClient]);

  return null;
}
