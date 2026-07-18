/**
 * Lecture validée des variables d'environnement Supabase publiques.
 *
 * Sans elles, `createBrowserClient`/`createServerClient` plantent avec un
 * message obscur (« supabaseUrl is required »). On lève ici une erreur
 * explicite et actionnable — cause n°1 d'une app qui « ne démarre pas »
 * (ex. `.env.local` absent, typiquement dans un worktree où il est gitignoré).
 */

export type SupabaseEnv = {
  url: string;
  anonKey: string;
};

export function getSupabaseEnv(): SupabaseEnv {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    const missing = [
      !url && "NEXT_PUBLIC_SUPABASE_URL",
      !anonKey && "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    ]
      .filter(Boolean)
      .join(", ");
    throw new Error(
      `Configuration Supabase manquante : ${missing}. ` +
        `Renseignez ces variables dans .env.local (dev) ou dans les variables ` +
        `d'environnement du déploiement (Vercel).`,
    );
  }

  return { url, anonKey };
}
