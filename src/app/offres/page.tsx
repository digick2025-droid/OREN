import Link from "next/link";
import { Check } from "lucide-react";
import { ScreenHeader } from "@/components/screen-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { formatAmountShort } from "@/lib/format";
import type { Plan } from "@/types/database";

/** Contenu marketing des offres (le prix et les quotas viennent de la base) */
const PLAN_CONTENT: Record<
  string,
  { tag: string; audience: string; features: string[] }
> = {
  express: {
    tag: "Payez à l'usage, sans compte",
    audience: "Usage occasionnel",
    features: [
      "1 devis à la fois",
      "Aperçu PDF professionnel",
      "Envoi WhatsApp",
      "Sans inscription",
    ],
  },
  pro: {
    tag: "L'essentiel pour facturer vite",
    audience: "Artisans indépendants",
    features: [
      "Profil entreprise",
      "Devis & factures",
      "Gestion des clients",
      "25 documents / mois",
      "Partage WhatsApp",
    ],
  },
  business: {
    tag: "Pour aller plus loin",
    audience: "Entreprises qui grandissent",
    features: [
      "Tout DIGICK Pro",
      "Documents illimités",
      "Catalogue & modèles",
      "Rapports simples",
    ],
  },
};

function planPrice(plan: Plan): string {
  if (plan.per_document_price_fcfa) {
    return `${formatAmountShort(plan.per_document_price_fcfa)} F / devis`;
  }
  if (plan.price_fcfa === 0) return "Gratuit";
  return `${formatAmountShort(plan.price_fcfa)} F / mois`;
}

export default async function OffresPage() {
  const supabase = await createClient();

  const [{ data: plansData }, authResult] = await Promise.all([
    supabase
      .from("plans")
      .select("*")
      .eq("is_active", true)
      .neq("key", "free")
      .order("sort_order"),
    supabase.auth.getUser(),
  ]);
  const plans = (plansData ?? []) as Plan[];
  const user = authResult.data.user;

  let currentPlanKey: string | null = null;
  if (user) {
    const { data: company } = await supabase
      .from("companies")
      .select("id")
      .eq("owner_id", user.id)
      .is("deleted_at", null)
      .maybeSingle();
    if (company) {
      const { data: sub } = await supabase
        .from("subscriptions")
        .select("plan_key")
        .eq("company_id", company.id)
        .eq("status", "active")
        .is("deleted_at", null)
        .maybeSingle();
      currentPlanKey = sub?.plan_key ?? null;
    }
  }

  return (
    <div className="mx-auto min-h-dvh w-full max-w-md bg-[#F4F5F7] pb-10">
      <ScreenHeader
        title="Nos offres"
        backHref={user ? "/abonnement" : "/"}
      />
      <p className="px-4 pt-4 text-[14px] text-[#5A6377]">
        Choisissez ce qui vous convient. Sans engagement.
      </p>

      <div className="mt-4 space-y-4 px-4">
        {plans.map((plan) => {
          const content = PLAN_CONTENT[plan.key] ?? {
            tag: "",
            audience: "",
            features: [],
          };
          const isCurrent = currentPlanKey === plan.key;
          const highlight = plan.key === "pro";

          return (
            <Card
              key={plan.key}
              className={
                highlight ? "border-2 border-coral p-5" : "p-5"
              }
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-[16px] font-extrabold text-navy">
                    {plan.name}
                  </div>
                  <div className="text-[12.5px] text-[#8A93A6]">
                    {content.tag}
                  </div>
                </div>
                <div className="text-right text-[15px] font-extrabold text-navy">
                  {planPrice(plan)}
                </div>
              </div>

              <ul className="mt-4 space-y-2">
                {content.features.map((feature) => (
                  <li
                    key={feature}
                    className="flex items-center gap-2 text-[13.5px] text-[#5A6377]"
                  >
                    <Check size={15} className="shrink-0 text-success" />
                    {feature}
                  </li>
                ))}
              </ul>

              <div className="mt-5">
                {isCurrent ? (
                  <div className="rounded-xl bg-[#EEF0F4] py-3 text-center text-[13.5px] font-bold text-[#5A6377]">
                    Offre actuelle
                  </div>
                ) : (
                  <Button
                    asChild
                    variant={highlight ? "accent" : "outline"}
                    className="w-full"
                  >
                    <Link
                      href={
                        plan.key === "express"
                          ? "/express"
                          : user
                            ? `/paiement?plan=${plan.key}`
                            : "/connexion"
                      }
                    >
                      Choisir cette offre
                    </Link>
                  </Button>
                )}
              </div>
              <p className="mt-2 text-center text-[11.5px] text-[#A6ADBD]">
                {content.audience}
              </p>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
