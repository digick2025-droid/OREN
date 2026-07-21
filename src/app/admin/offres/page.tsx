"use client";

import Link from "next/link";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useAdminPlans,
  useRestorePlanPrices,
  useSetAllPlansFree,
} from "@/hooks/use-admin-plans";
import { formatAmount } from "@/lib/format";

export default function AdminOffresPage() {
  const { data: plans, isLoading } = useAdminPlans();
  const setAllFree = useSetAllPlansFree();
  const restorePrices = useRestorePlanPrices();

  const inPromo = (plans ?? []).some(
    (p) => p.promo_price_snapshot_fcfa != null,
  );

  const handleSetAllFree = () => {
    if (
      !window.confirm(
        "Passer TOUTES les offres à 0 F ? Les prix actuels seront sauvegardés et pourront être restaurés ensuite.",
      )
    ) {
      return;
    }
    setAllFree.mutate(undefined, {
      onSuccess: () => toast.success("Toutes les offres sont maintenant gratuites."),
      onError: (err) => toast.error(err.message),
    });
  };

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
            Prix, quotas et contenu marketing affichés sur /offres.
          </p>
        </div>
        {inPromo ? (
          <Button
            variant="outline"
            onClick={handleRestore}
            disabled={restorePrices.isPending}
          >
            {restorePrices.isPending ? "Restauration…" : "Restaurer les prix d'origine"}
          </Button>
        ) : (
          <Button
            variant="outline"
            onClick={handleSetAllFree}
            disabled={setAllFree.isPending}
          >
            {setAllFree.isPending ? "Application…" : "Tout mettre à gratuit"}
          </Button>
        )}
      </div>

      {inPromo ? (
        <div className="rounded-xl border-[1.5px] border-coral/30 bg-coral/10 px-4 py-3 text-[13px] font-semibold text-coral">
          Mode promo actif : toutes les offres passées à 0 F sont marquées ci-dessous.
          Utilisez « Restaurer les prix d&rsquo;origine » pour revenir aux tarifs normaux.
        </div>
      ) : null}

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-40 w-full" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(plans ?? []).map((plan) => (
            <Link key={plan.key} href={`/admin/offres/${plan.key}`}>
              <Card className="h-full transition-colors hover:border-primary/40">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between">
                    <span className="text-[15px] font-bold text-navy">
                      {plan.name}
                    </span>
                    <div className="flex items-center gap-1.5">
                      {plan.promo_price_snapshot_fcfa != null ? (
                        <Badge variant="warning">Promo</Badge>
                      ) : null}
                      <Badge variant={plan.is_active ? "success" : "neutral"}>
                        {plan.is_active ? "Active" : "Désactivée"}
                      </Badge>
                    </div>
                  </div>
                  <p className="mt-1 text-[12.5px] text-muted-foreground">
                    {plan.key}
                  </p>
                  <div className="mt-3 text-lg font-bold text-navy">
                    {plan.per_document_price_fcfa
                      ? `${formatAmount(plan.per_document_price_fcfa)} / devis`
                      : plan.price_fcfa === 0
                        ? "Gratuit"
                        : `${formatAmount(plan.price_fcfa)} / mois`}
                  </div>
                  {plan.monthly_quota != null ? (
                    <p className="text-[12.5px] text-muted-foreground">
                      {plan.monthly_quota} documents / mois
                    </p>
                  ) : null}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
