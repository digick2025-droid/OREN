import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Client Supabase **service role** — réservé au serveur (webhook / confirmation
 * de paiement). Il contourne la RLS ; on ne l'utilise donc QUE pour les
 * opérations déclenchées par un webhook déjà vérifié (signature HMAC), jamais
 * à partir d'entrées client non authentifiées.
 *
 * La clé provient de SUPABASE_SERVICE_ROLE_KEY (jamais exposée au client).
 */
export function createServiceClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY / URL manquant(e)s");
  }
  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
