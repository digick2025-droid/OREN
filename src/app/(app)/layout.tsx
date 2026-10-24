import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { LastSeenTracker } from "@/components/last-seen-tracker";
import { CompanyProvider } from "@/features/company/company-context";
import { ReferralApply } from "@/features/referral/referral-apply";
import { createClient } from "@/lib/supabase/server";
import type { Company, CompanyRole } from "@/types/database";

type Membership = { role: CompanyRole; company: Company };

export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/connexion");

  // Entreprises accessibles : celles où l'utilisateur est membre actif
  // (le propriétaire y figure toujours — backfill + trigger de 0037).
  const { data: memberRows } = await supabase
    .from("company_members")
    .select("role, company:companies(*)")
    .eq("user_id", user.id)
    .eq("status", "active")
    .is("deleted_at", null);

  // L'embed `company:companies(*)` est inféré en tableau par supabase-js alors
  // qu'une relation to-one renvoie un objet — on passe par `unknown`.
  const memberships: Membership[] = (
    (memberRows ?? []) as unknown as {
      role: CompanyRole;
      company: Company | null;
    }[]
  )
    .filter((r): r is Membership => !!r.company && !r.company.deleted_at)
    .map((r) => ({ role: r.role, company: r.company }));

  // Repli défensif : entreprise possédée. Couvre aussi le cas où les
  // migrations 0037/0038 ne sont pas encore appliquées (la requête
  // ci-dessus échoue silencieusement, memberRows = null).
  if (memberships.length === 0) {
    const { data: owned } = await supabase
      .from("companies")
      .select("*")
      .eq("owner_id", user.id)
      .is("deleted_at", null)
      .maybeSingle();
    if (owned) memberships.push({ role: "gerant", company: owned as Company });
  }

  // Aucune entreprise : invitation en attente → écran d'acceptation,
  // sinon parcours de création (comportement historique).
  if (memberships.length === 0) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("phone")
      .eq("id", user.id)
      .maybeSingle();
    if (profile?.phone) {
      const { count } = await supabase
        .from("company_invitations")
        .select("id", { count: "exact", head: true })
        .eq("phone", profile.phone)
        .eq("status", "pending");
      if ((count ?? 0) > 0) redirect("/invitations");
    }
    redirect("/bienvenue");
  }

  // Entreprise courante : cookie si valide, sinon celle possédée, sinon la 1re.
  const cookieStore = await cookies();
  const wantedId = cookieStore.get("oren_company_id")?.value;
  const current =
    memberships.find((m) => m.company.id === wantedId) ??
    memberships.find((m) => m.company.owner_id === user.id) ??
    memberships[0];
  if (!current) redirect("/bienvenue");

  if (current.company.suspended_at) redirect("/suspendu");

  return (
    <CompanyProvider company={current.company} role={current.role}>
      <LastSeenTracker />
      <ReferralApply />
      <AppShell>{children}</AppShell>
    </CompanyProvider>
  );
}
