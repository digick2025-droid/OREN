import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/** Vérifie session + appartenance à admin_users, redirige sinon (idiome (app)/layout.tsx). */
export async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/connexion");

  const { data: admin } = await supabase
    .from("admin_users")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!admin) redirect("/accueil");

  return user;
}
