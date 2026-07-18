/**
 * Partage du document — dépose le rendu A4 autonome dans Supabase
 * Storage (bucket privé « documents ») et renvoie une URL signée.
 *
 * Le document stocké est un HTML autonome (styles inline, prêt pour
 * « Imprimer → PDF » côté destinataire). On évite ainsi toute
 * dépendance de génération PDF côté navigateur : le lien s'ouvre
 * de façon fiable sur mobile, où l'impression d'iframe est capricieuse.
 *
 * Ce module est la seule partie du moteur PDF qui connaît Supabase :
 * le rendu (index/templates) reste indépendant de l'infrastructure.
 */

import { createClient } from "@/lib/supabase/client";

/** Bucket privé dédié aux documents partageables. */
export const DOCUMENTS_BUCKET = "documents";

/** Durée de validité de l'URL signée : ~1 an (le lien reste ouvrable). */
const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 365;

export interface ShareDocumentInput {
  /** Identifiant de l'entreprise — sert de dossier racine (scope RLS). */
  companyId: string;
  /** Identifiant du document — sert de nom de fichier stable. */
  docId: string;
  /** HTML A4 autonome déjà rendu par renderDocumentHtml. */
  html: string;
}

/**
 * Téléverse le document et renvoie une URL signée partageable.
 * Lève en cas d'échec (bucket absent, RLS, réseau) : l'appelant
 * décide alors de retomber sur un partage texte simple.
 */
export async function uploadSharedDocument({
  companyId,
  docId,
  html,
}: ShareDocumentInput): Promise<string> {
  const supabase = createClient();
  // Dossier = companyId (exigé par les policies RLS du bucket).
  const path = `${companyId}/${docId}.html`;
  const blob = new Blob([html], { type: "text/html; charset=utf-8" });

  const { error: uploadError } = await supabase.storage
    .from(DOCUMENTS_BUCKET)
    .upload(path, blob, {
      upsert: true,
      contentType: "text/html; charset=utf-8",
      cacheControl: "3600",
    });
  if (uploadError) {
    throw uploadError;
  }

  const { data, error: signError } = await supabase.storage
    .from(DOCUMENTS_BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
  if (signError || !data?.signedUrl) {
    throw signError ?? new Error("Impossible de générer l'URL signée");
  }

  return data.signedUrl;
}
