"use client";

import Link from "next/link";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAdminPlans, useRestorePlanPrices } from "@/hooks/use-admin-plans";
import { FREE_LAUNCH } from "@/lib/billing";
import { formatAmount } from "@/lib/format";
import { annualPrice } from "@/lib/pricing";
import type { Plan } from "@/types/database";

/** Prix tels que l'artisan les voit : semaine · mois · année, ou à l'unité. */
function priceLines(plan: Plan): string[] {
  if (plan.per_document_price_fcfa) {
    return [`${formatAmount(plan.per_document_price_fcfa)} / document`];
  }
  if (plan.price_fcfa === 0) return ["Gratuit"];
  return [
    plan.week_price_fcfa ? `${formatAmount(plan.week_price_fcfa)} / semaine` : null,
    `${formatAmount(plan.price_fcfa)} / mois`,
    `${formatAmount(annualPrice(plan.price_fcfa))} / an`,
  ].filter((line): line is string => line !== null);
}

export default function AdminOffresPage() {
  const { data: plans, isLoading } = useAdminPlans();
  const restorePrices = useRestorePlanPrices();

  // Les offres retirées (Business, migration 0042) restent en base pour
  // l'historique mais n'ont plus rien à régler ici.
  const activePlans = (plans ?? []).filter((p) => p.is_active);
  const inPromo = activePlans.some((p) => p.promo_price_snapshot_fcfa != null);

  const handleRestore = () => {
    if (!window.confirm("Restaurer les prix d'origine de toutes les offres ?")) {
      return;
    }
    restorePrices.mutate(undefined, {
      onSuccess: () => toast.success("Prix d'origine restaurés."),
      onError: (err) => toast.error(err.message),
    });
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-navy">Offres</h1>
          <p className="text-[13.5px] text-muted-foreground">
            Gratuit et Pro sur /offres ; le document à l&rsquo;unité est
            proposé au blocage du quota et en Express sans compte.
          </p>
        </div>
        {/* Reste du lancement gratuit (0036) : ne s'affiche que si des prix
            sont encore à 0 F avec leur sauvegarde. */}
        {inPromo ? (
          <Button
            variant="outline"
            onClick={handleRestore}
            disabled={restorePrices.isPending}
          >
            {restorePrices.isPending ? "Restauration…" : "Restaurer les prix d'origine"}
          </Button>
        ) : null}
      </div>

      {FREE_LAUNCH ? (
        <div className="rounded-xl border-[1.5px] border-warning/40 bg-warning/10 px-4 py-3 text-[13px] text-warning-foreground">
          <span className="font-bold">Lancement gratuit actif.</span>{" "}
          L&rsquo;application ne présente plus aucun écran de paiement et
          annonce l&rsquo;illimité (FREE_LAUNCH, src/lib/billing.ts).
          Restaurer les prix ici remettrait aussi les quotas en base, alors que
          l&rsquo;interface promet encore la gratuité : ne le faites qu&rsquo;en
          même temps que le déploiement qui repasse FREE_LAUNCH à false.
        </div>
      ) : null}

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-40 w-full" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {activePlans.map((plan) => (
            <Link key={plan.key} href={`/admin/offres/${plan.key}`}>
              <Card className="h-full transition-colors hover:border-primary/40">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between">
                    <span className="text-[15px] font-bold text-navy">
                      {plan.per_document_price_fcfa ? "Document à l'unité" : plan.name}
                    </span>
                    {plan.promo_price_snapshot_fcfa != null ? (
                      <Badge variant="warning">Promo</Badge>
                    ) : null}
                  </div>
                  <div className="mt-3 space-y-0.5">
                    {priceLines(plan).map((line, i) => (
                      <div
                        key={line}
                        className={
                          i === 0
                            ? "text-lg font-bold text-navy"
                            : "text-[13px] font-semibold text-navy"
                        }
                      >
                        {line}
                      </div>
                    ))}
                  </div>
                  <p className="mt-1 text-[12.5px] text-muted-foreground">
                    {plan.per_document_price_fcfa
                      ? "Sans compte, ou après le quota"
                      : plan.monthly_quota != null
                        ? `${plan.monthly_quota} documents / mois`
                        : "Documents illimités"}
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
