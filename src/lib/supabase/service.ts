import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Client Supabase **service role** — réservé au serveur. Il contourne la RLS ;
 * on ne l'utilise donc QUE derrière une vérification propre (signature HMAC
 * d'un webhook, secret de tâche planifiée), jamais à partir d'une entrée
 * client authentifiée par la seule session.
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
