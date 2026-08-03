"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

/** Une trace par demi-journée suffit : le seuil d'inactivité est en jours. */
const INTERVALLE_MS = 12 * 3600 * 1000;
const CLE = "oren_last_seen_ping";

/**
 * Note que l'utilisateur a ouvert l'application.
 *
 * Sans ce signal, les relances d'inactivité sont aveugles :
 * `auth.users.last_sign_in_at` ne bouge pas d'une visite à l'autre, une
 * session Supabase se renouvelant toute seule pendant des semaines. On
 * relancerait alors des gens qui utilisent l'application tous les jours —
 * la façon la plus rapide de faire couper les notifications.
 */
export function LastSeenTracker() {
  useEffect(() => {
    let derniere = 0;
    try {
      derniere = Number(localStorage.getItem(CLE) ?? 0);
    } catch {
      // navigation privée : on écrira à chaque ouverture, sans conséquence
    }
    if (Date.now() - derniere < INTERVALLE_MS) return;

    void createClient()
      .rpc("touch_last_seen")
      .then(({ error }) => {
        if (error) return;
        try {
          localStorage.setItem(CLE, String(Date.now()));
        } catch {
          // idem : l'écriture en base a réussi, c'est le seul point qui compte
        }
      });
  }, []);

  return null;
}
