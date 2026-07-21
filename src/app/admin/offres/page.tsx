"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAdminPlans } from "@/hooks/use-admin-plans";
import { formatAmount } from "@/lib/format";

export default function AdminOffresPage() {
  const { data: plans, isLoading } = useAdminPlans();

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-navy">Offres</h1>
        <p className="text-[13.5px] text-muted-foreground">
          Prix, quotas et contenu marketing affichés sur /offres.
        </p>
      </div>

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
                    <Badge variant={plan.is_active ? "success" : "neutral"}>
                      {plan.is_active ? "Active" : "Désactivée"}
                    </Badge>
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
