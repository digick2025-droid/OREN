import { redirect } from "next/navigation";
import { Ban } from "lucide-react";
import { SignOutButton } from "@/components/sign-out-button";
import { createClient } from "@/lib/supabase/server";

/**
 * OREN · Compte suspendu.
 * Filet de sécurité côté page pour un compte dont l'accès a été coupé par un
 * administrateur (`companies.suspended_at`) — le layout (app) redirige ici,
 * et `assert_quota` bloque aussi la création de documents en profondeur.
 */
export default async function SuspenduPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/connexion");

  const { data: company } = await supabase
    .from("companies")
    .select("suspended_at, suspended_reason")
    .eq("owner_id", user.id)
    .is("deleted_at", null)
    .maybeSingle();
  if (!company) redirect("/bienvenue");
  if (!company.suspended_at) redirect("/accueil");

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center bg-surface px-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-error-surface text-error">
        <Ban size={28} />
      </div>

      <p className="mt-6 text-[13px] font-bold uppercase tracking-[0.18em] text-accent">
        Compte suspendu
      </p>
      <h1 className="mt-2 text-[24px] font-extrabold text-navy">
        Accès temporairement bloqué
      </h1>
      <p className="mt-2 max-w-xs text-[14px] text-muted-foreground">
        {company.suspended_reason ||
          "Votre compte a été suspendu par un administrateur OREN."}
      </p>
      <p className="mt-1 max-w-xs text-[13px] text-muted-foreground">
        Contactez le support DIGICK pour en savoir plus.
      </p>

      <div className="mt-8 w-full max-w-xs">
        <SignOutButton />
      </div>
    </div>
  );
}
