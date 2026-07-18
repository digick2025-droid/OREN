/**
 * Aides partagées pour les tests d'intégration Supabase.
 *
 * Les tests d'isolation RLS et de RPC ont besoin d'une vraie instance
 * Supabase (locale via `supabase start`, ou un projet de test distant) avec
 * les migrations de `supabase/migrations/` appliquées.
 *
 * Variables d'environnement attendues (aucune n'est committée) :
 *   - SUPABASE_URL              (ou NEXT_PUBLIC_SUPABASE_URL)
 *   - SUPABASE_ANON_KEY         (ou NEXT_PUBLIC_SUPABASE_ANON_KEY)
 *   - SUPABASE_SERVICE_ROLE_KEY (clé service role — seed des utilisateurs)
 *
 * Si l'une manque, `getTestEnv()` renvoie `null` et les suites concernées
 * sont ignorées proprement (`describe.skipIf`) plutôt que de planter.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export type TestEnv = {
  url: string;
  anonKey: string;
  serviceKey: string;
};

export function getTestEnv(): TestEnv | null {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey =
    process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !anonKey || !serviceKey) return null;
  return { url, anonKey, serviceKey };
}

/** Client administrateur (service role) : bypass RLS, seed des utilisateurs. */
export function adminClient(env: TestEnv): SupabaseClient {
  return createClient(env.url, env.serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/** Client anonyme non authentifié (soumis à la RLS). */
export function anonClient(env: TestEnv): SupabaseClient {
  return createClient(env.url, env.anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

let seq = 0;

/** Identité de test unique et jetable. */
export function uniqueEmail(prefix = "rls"): string {
  seq += 1;
  return `${prefix}-${Date.now()}-${seq}-${Math.random()
    .toString(36)
    .slice(2, 8)}@oren-test.local`;
}

const PASSWORD = "Test-Password-123!";

export type TestUser = {
  id: string;
  email: string;
  /** Client anonyme authentifié en tant que cet utilisateur (RLS active). */
  client: SupabaseClient;
};

/**
 * Crée un utilisateur (email confirmé) via l'API admin puis renvoie un client
 * authentifié en son nom. Enregistre l'id pour le nettoyage.
 */
export async function createTestUser(
  env: TestEnv,
  admin: SupabaseClient,
  createdUserIds: string[],
  prefix = "rls",
): Promise<TestUser> {
  const email = uniqueEmail(prefix);
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
  });
  if (error || !data.user) {
    throw new Error(`createUser failed: ${error?.message ?? "no user"}`);
  }
  createdUserIds.push(data.user.id);

  const client = anonClient(env);
  const { error: signInError } = await client.auth.signInWithPassword({
    email,
    password: PASSWORD,
  });
  if (signInError) {
    throw new Error(`signIn failed: ${signInError.message}`);
  }

  return { id: data.user.id, email, client };
}

/**
 * Crée une entreprise appartenant à l'utilisateur courant du client fourni.
 * Le trigger `on_company_created` lui associe l'offre gratuite (quota 3 à vie).
 */
export async function createCompany(
  client: SupabaseClient,
  name: string,
): Promise<string> {
  const { data: auth } = await client.auth.getUser();
  const ownerId = auth.user?.id;
  const { data, error } = await client
    .from("companies")
    .insert({ owner_id: ownerId, name })
    .select("id")
    .single();
  if (error || !data) {
    throw new Error(`createCompany failed: ${error?.message ?? "no row"}`);
  }
  return data.id as string;
}

/** Supprime définitivement les utilisateurs de test (cascade sur companies). */
export async function cleanupUsers(
  admin: SupabaseClient,
  userIds: string[],
): Promise<void> {
  for (const id of userIds) {
    try {
      await admin.auth.admin.deleteUser(id);
    } catch {
      // best-effort
    }
  }
}
