"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useCompany } from "@/features/company/company-context";
import { useI18n } from "@/features/i18n/language-context";
import { track } from "@/lib/analytics";
import { OUTBOX_SYNC_EVENT, outboxFor, syncOutbox } from "@/lib/outbox";
import { createClient } from "@/lib/supabase/client";

/**
 * Écrans préchargés pour le hors-ligne : ceux d'où l'on crée et retrouve un
 * document. Les fiches (document, client) le sont à leur première ouverture.
 */
const OFFLINE_PAGES = [
  "/accueil",
  "/documents",
  "/nouveau?type=devis",
  "/nouveau?type=facture",
  "/nouveau?type=proforma",
  "/clients",
  "/clients/nouveau",
  "/catalogue",
  "/reglages",
];

/** Relance de la boîte d'envoi tant qu'elle n'est pas vide : `online` ne se
 * déclenche pas quand un Wi-Fi sans internet retrouve sa connexion. */
const RETRY_MS = 45_000;

/**
 * Mode hors-ligne côté app connectée :
 *  - envoie les documents créés sans réseau dès qu'il revient ;
 *  - demande au service worker de garder les écrans essentiels en cache.
 *
 * Monté dans le layout de l'app (session et entreprise connues), jamais sur
 * les pages publiques : un visiteur sans session ferait précharger des
 * redirections vers /connexion.
 */
export function OfflineSync() {
  const company = useCompany();
  const queryClient = useQueryClient();
  const { t } = useI18n();

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!navigator.onLine) return;
      if (!outboxFor(company.id).some((e) => !e.error)) return;
      const { synced, failed } = await syncOutbox(createClient(), company.id);
      if (cancelled) return;
      if (synced.length > 0) {
        for (const doc of synced) track("document_generated", { type: doc.type, offline: true });
        void queryClient.invalidateQueries({ queryKey: ["documents", company.id] });
        void queryClient.invalidateQueries({ queryKey: ["usage", company.id] });
        void queryClient.invalidateQueries({ queryKey: ["clients", company.id] });
        toast.success(t.toast_outbox_synced.replace("{n}", String(synced.length)));
      }
      if (failed.length > 0) toast.error(t.toast_outbox_failed);
    };

    const onVisible = () => {
      if (document.visibilityState === "visible") void run();
    };

    void run();
    window.addEventListener("online", run);
    window.addEventListener(OUTBOX_SYNC_EVENT, run);
    document.addEventListener("visibilitychange", onVisible);
    const timer = window.setInterval(() => void run(), RETRY_MS);
    return () => {
      cancelled = true;
      window.removeEventListener("online", run);
      window.removeEventListener(OUTBOX_SYNC_EVENT, run);
      document.removeEventListener("visibilitychange", onVisible);
      window.clearInterval(timer);
    };
  }, [company.id, queryClient, t]);

  useEffect(() => {
    if (!("serviceWorker" in navigator) || process.env.NODE_ENV !== "production") {
      return;
    }
    const warm = () => {
      if (!navigator.onLine) return;
      void navigator.serviceWorker.ready.then((registration) => {
        registration.active?.postMessage({ type: "warm", urls: OFFLINE_PAGES });
      });
    };
    // Après le premier affichage : le préchargement ne doit pas concurrencer
    // l'écran que l'utilisateur vient d'ouvrir.
    const timer = window.setTimeout(warm, 3000);
    window.addEventListener("online", warm);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("online", warm);
    };
  }, [company.id]);

  return null;
}
