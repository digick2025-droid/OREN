import { redirect } from "next/navigation";
import { ScreenHeader } from "@/components/screen-header";
import { CompanyForm } from "@/features/company/company-form";
import { createClient } from "@/lib/supabase/server";
import type { Company } from "@/types/database";

export default async function EntreprisePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/connexion");

  const { data: company } = await supabase
    .from("companies")
    .select("*")
    .eq("owner_id", user.id)
    .is("deleted_at", null)
    .maybeSingle();
  if (!company) redirect("/bienvenue");

  return (
    <div>
      <ScreenHeader title="Profil entreprise" backHref="/reglages" />
      <CompanyForm company={company as Company} userId={user.id} />
    </div>
  );
}
