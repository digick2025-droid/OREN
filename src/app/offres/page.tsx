import Link from "next/link";
import { cookies } from "next/headers";
import { Check } from "lucide-react";
import { ScreenHeader } from "@/components/screen-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FREE_LAUNCH } from "@/lib/billing";
import { APP_NAME } from "@/lib/constants";
import { LANG_COOKIE, parseLang } from "@/lib/i18n/config";
import { getDict, type Dict } from "@/lib/i18n/dictionaries";
import { createClient } from "@/lib/supabase/server";
import { formatAmountShort } from "@/lib/format";
import type { Plan } from "@/types/database";

function planPrice(t: Dict, plan: Plan): string {
  if (plan.per_document_price_fcfa) {
    return `${formatAmountShort(plan.per_document_price_fcfa)} F / ${t.per_quote}`;
  }
  if (plan.price_fcfa === 0) return t.price_free;
  return `${formatAmountShort(plan.price_fcfa)} F / ${t.per_month}`;
}

export default async function OffresPage() {
  const supabase = await createClient();
  const cookieStore = await cookies();
  const lang = parseLang(cookieStore.get(LANG_COOKIE)?.value);
  const t = getDict(lang);

  // Pendant le lancement gratuit il n'y a plus d'offre à comparer : la page
  // reste en place (elle est liée depuis la home et le footer) mais dit
  // simplement que tout est offert. On évite donc les requêtes `plans` et
  // `subscriptions`, inutiles ici.
  if (FREE_LAUNCH) {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    return (
      <div className="mx-auto min-h-dvh w-full max-w-md bg-surface pb-10">
        <ScreenHeader
          title={t.off_title}
          backHref={user ? "/abonnement" : "/"}
        />
        <p className="px-4 pt-4 text-[14px] leading-relaxed text-muted-foreground">
          {t.free_lead}
        </p>

        <div className="mt-4 px-4">
          <Card className="relative border-2 border-coral p-5">
            <span className="absolute -top-2.5 left-5 rounded-full bg-accent px-2.5 py-1 text-[11px] font-extrabold text-accent-foreground">
              {t.free_badge}
            </span>
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-[16px] font-extrabold text-navy">
                {APP_NAME}
              </span>
              <span className="shrink-0 text-[20px] font-extrabold tabular-nums text-navy">
                {t.free_price}{" "}
                <small className="text-[12px] font-semibold text-muted-foreground">
                  {t.free_price_unit}
                </small>
              </span>
            </div>

            <ul className="mt-4 space-y-2">
              {[t.free_f1, t.free_f2, t.free_f3, t.free_f4].map((item) => (
                <li
                  key={item}
                  className="flex items-start gap-2 text-[13.5px] leading-snug text-muted-foreground"
                >
                  <Check size={15} className="mt-[2px] shrink-0 text-success" />
                  {item}
                </li>
              ))}
            </ul>

            <Button asChild variant="accent" className="mt-5 w-full">
              <Link href={user ? "/accueil" : "/inscription"}>
                {user ? t.free_cta_app : t.land_cta_primary}
              </Link>
            </Button>
            <p className="mt-2 text-center text-[11.5px] text-muted-foreground/70">
              {t.free_note}
            </p>
          </Card>

          <p className="mt-5 text-[12.5px] leading-relaxed text-muted-foreground/80">
            {t.free_later}
          </p>
        </div>
      </div>
    );
  }

  const [{ data: plansData }, authResult] = await Promise.all([
    supabase
      .from("plans")
      .select("*")
      .eq("is_active", true)
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
    <div className="mx-auto min-h-dvh w-full max-w-md bg-surface pb-10">
      <ScreenHeader title={t.off_title} backHref={user ? "/abonnement" : "/"} />
      <p className="px-4 pt-4 text-[14px] text-muted-foreground">{t.off_sub}</p>

      <div className="mt-4 space-y-4 px-4">
        {plans.map((plan) => {
          const content = plan.marketing?.[lang] ?? { tag: "", audience: "", features: [] };
          const isCurrent = currentPlanKey === plan.key;
          const highlight = plan.key === "pro";

          return (
            <Card
              key={plan.key}
              className={highlight ? "border-2 border-coral p-5" : "p-5"}
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-[16px] font-extrabold text-navy">
                    {plan.name}
                  </div>
                  <div className="text-[12.5px] text-muted-foreground/70">
                    {content.tag}
                  </div>
                </div>
                <div className="text-right text-[15px] font-extrabold text-navy">
                  {planPrice(t, plan)}
                </div>
              </div>

              <ul className="mt-4 space-y-2">
                {content.features.map((feature) => (
                  <li
                    key={feature}
                    className="flex items-center gap-2 text-[13.5px] text-muted-foreground"
                  >
                    <Check size={15} className="shrink-0 text-success" />
                    {feature}
                  </li>
                ))}
              </ul>

              <div className="mt-5">
                {isCurrent ? (
                  <div className="rounded-xl bg-muted py-3 text-center text-[13.5px] font-bold text-muted-foreground">
                    {t.off_current}
                  </div>
                ) : (
                  <Button
                    asChild
                    variant={highlight ? "accent" : "outline"}
                    className="w-full"
                  >
                    <Link
                      href={
                        plan.key === "free"
                          ? "/inscription"
                          : plan.key === "express"
                            ? "/express"
                            : user
                              ? `/paiement?plan=${plan.key}`
                              : "/connexion"
                      }
                    >
                      {plan.key === "free" ? t.land_cta_primary : t.off_choose}
                    </Link>
                  </Button>
                )}
              </div>
              <p className="mt-2 text-center text-[11.5px] text-muted-foreground/70">
                {content.audience}
              </p>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
