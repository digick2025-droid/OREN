import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { CompanyProvider } from "@/features/company/company-context";
import { createClient } from "@/lib/supabase/server";
import type { Company } from "@/types/database";

export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
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
    <CompanyProvider company={company as Company}>
      <AppShell>{children}</AppShell>
    </CompanyProvider>
  );
}
