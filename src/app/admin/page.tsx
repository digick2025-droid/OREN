"use client";

import {
  AlertTriangle,
  Ban,
  Building2,
  CreditCard,
  FileText,
  TrendingUp,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AnnouncementForm } from "@/features/admin/announcement-form";
import { useAdminStats } from "@/hooks/use-admin-stats";
import { usePlans } from "@/hooks/use-usage";
import { formatAmount } from "@/lib/format";

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: LucideIcon;
  label: string;
  value: React.ReactNode;
  hint?: string;
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Icon size={16} />
          <span className="text-[12.5px] font-semibold uppercase tracking-wide">
            {label}
          </span>
        </div>
        <div className="mt-2 text-2xl font-bold text-navy">{value}</div>
        {hint ? (
          <div className="mt-0.5 text-[12.5px] text-muted-foreground">{hint}</div>
        ) : null}
      </CardContent>
    </Card>
  );
}

export default function AdminOverviewPage() {
  const { data: stats, isLoading } = useAdminStats();
  const { data: plans } = usePlans();

  if (isLoading || !stats) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-[110px] w-full" />
        ))}
      </div>
    );
  }

  const planName = (key: string) =>
    plans?.find((p) => p.key === key)?.name ?? key;
  const activePlans = Object.entries(stats.active_subscriptions_by_plan);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-navy">Vue d&rsquo;ensemble</h1>
        <p className="text-[13.5px] text-muted-foreground">
          Statistiques en temps réel de l&rsquo;ensemble des entreprises OREN.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          icon={TrendingUp}
          label="MRR"
          value={formatAmount(stats.mrr_fcfa)}
          hint="Revenu mensuel récurrent"
        />
        <StatCard
          icon={CreditCard}
          label="Revenu 30 jours"
          value={formatAmount(stats.revenue_30d_fcfa)}
          hint={`Total : ${formatAmount(stats.revenue_total_fcfa)}`}
        />
        <StatCard
          icon={Building2}
          label="Entreprises"
          value={stats.companies_total}
          hint={`+${stats.companies_30d} sur 30 jours`}
        />
        <StatCard
          icon={FileText}
          label="Documents"
          value={stats.documents_30d}
          hint={`${stats.documents_total} au total`}
        />
        <StatCard
          icon={AlertTriangle}
          label="Paiements"
          value={stats.payment_intents_pending}
          hint={`${stats.payment_intents_failed_7d} échoués (7j)`}
        />
        <StatCard
          icon={Ban}
          label="Comptes suspendus"
          value={stats.companies_suspended}
        />
      </div>

      <Card>
        <CardContent className="p-5">
          <h2 className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">
            Abonnements actifs par offre
          </h2>
          {activePlans.length === 0 ? (
            <p className="mt-3 text-[13.5px] text-muted-foreground">
              Aucun abonnement actif pour l&rsquo;instant.
            </p>
          ) : (
            <div className="mt-3 space-y-2">
              {activePlans.map(([key, count]) => (
                <div
                  key={key}
                  className="flex items-center justify-between border-b border-border py-2 text-[13.5px] last:border-0"
                >
                  <span className="font-medium text-foreground">
                    {planName(key)}
                  </span>
                  <span className="font-semibold text-navy">{count}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <AnnouncementForm />
    </div>
  );
}
