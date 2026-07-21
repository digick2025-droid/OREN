import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ExpressForm } from "./express-form";

export default async function ExpressPage() {
  const supabase = await createClient();
  // RLS (plans_select_all) ne renvoie que les offres actives : une offre
  // désactivée par l'admin donne `plan === null` ici, comme une clé absente.
  const { data: plan } = await supabase
    .from("plans")
    .select("is_active")
    .eq("key", "express")
    .maybeSingle();
  if (!plan?.is_active) redirect("/offres");

  return <ExpressForm />;
}
