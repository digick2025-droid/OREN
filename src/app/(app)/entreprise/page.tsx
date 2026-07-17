import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ScreenHeader } from "@/components/screen-header";
import { CompanyForm } from "@/features/company/company-form";
import { LANG_COOKIE, parseLang } from "@/lib/i18n/config";
import { getDict } from "@/lib/i18n/dictionaries";
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

  const cookieStore = await cookies();
  const t = getDict(parseLang(cookieStore.get(LANG_COOKIE)?.value));

  return (
    <div>
      <ScreenHeader title={t.company_profile} backHref="/reglages" />
      <CompanyForm company={company as Company} userId={user.id} />
    </div>
  );
}
