import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { CompanyForm } from "@/features/company/company-form";
import { AutoOnboard } from "@/features/auth/auto-onboard";
import { LANG_COOKIE, parseLang } from "@/lib/i18n/config";
import { getDict } from "@/lib/i18n/dictionaries";
import { createClient } from "@/lib/supabase/server";

export default async function BienvenuePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/connexion");

  const { data: company } = await supabase
    .from("companies")
    .select("id")
    .eq("owner_id", user.id)
    .is("deleted_at", null)
    .maybeSingle();
  if (company) redirect("/accueil");

  const cookieStore = await cookies();
  const t = getDict(parseLang(cookieStore.get(LANG_COOKIE)?.value));

  return (
    <div className="mx-auto min-h-dvh w-full max-w-md bg-surface">
      <AutoOnboard />
      <div className="px-4 pt-10">
        <h1 className="text-[26px] font-extrabold text-navy">
          {t.setup_title}
        </h1>
        <p className="mt-1.5 text-[14px] text-muted-foreground">{t.setup_sub}</p>
      </div>
      <CompanyForm
        company={null}
        userId={user.id}
        defaultPhone={user.phone ?? ""}
      />
    </div>
  );
}
