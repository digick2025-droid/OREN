import { redirect } from "next/navigation";
import { CompanyForm } from "@/features/company/company-form";
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

  return (
    <div className="mx-auto min-h-dvh w-full max-w-md bg-[#F4F5F7]">
      <div className="px-4 pt-10">
        <h1 className="text-[26px] font-extrabold text-navy">
          Votre entreprise
        </h1>
        <p className="mt-1.5 text-[14px] text-[#5A6377]">
          Ces informations apparaîtront automatiquement sur vos devis et
          factures.
        </p>
      </div>
      <CompanyForm
        company={null}
        userId={user.id}
        defaultPhone={user.phone ?? ""}
      />
    </div>
  );
}
