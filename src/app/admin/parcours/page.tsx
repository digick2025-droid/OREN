"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAdminFunnel } from "@/hooks/use-admin-funnel";
import {
  ACCOUNT_FUNNEL,
  EXPRESS_FUNNEL,
  buildFunnel,
  formatDuration,
  type FunnelRow,
} from "@/lib/funnel";
import { cn } from "@/lib/utils";

const PERIODS = [7, 30, 90] as const;

function TimingCard({
  label,
  hint,
  median,
  under,
  count,
}: {
  label: string;
  hint: string;
  median: number | null;
  under: number;
  count: number;
}) {
  const share = count > 0 ? Math.round((under / count) * 100) : null;
  return (
    <Card>
      <CardContent className="p-5">
        <div className="text-[12.5px] font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </div>
        <div className="mt-2 text-2xl font-bold text-navy tabular-nums">
          {formatDuration(median)}
        </div>
        <div className="mt-0.5 text-[12.5px] text-muted-foreground">
          {count === 0
            ? "Pas encore de mesure sur la période"
            : `Médiane sur ${count} · ${share} % en 2 min ou moins`}
        </div>
        <p className="mt-2 text-[12px] text-muted-foreground/80">{hint}</p>
      </CardContent>
    </Card>
  );
}

function FunnelCard({ title, rows }: { title: string; rows: FunnelRow[] }) {
  return (
    <Card>
      <CardContent className="p-5">
        <h2 className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </h2>
        <ol className="mt-4 space-y-3">
          {rows.map((row) => (
            <li key={row.event}>
              <div className="flex items-baseline justify-between gap-3 text-[13.5px]">
                <span className="font-medium text-foreground">{row.label}</span>
                <span className="shrink-0 tabular-nums text-muted-foreground">
                  <span className="font-semibold text-navy">{row.devices}</span>
                  {row.fromPrevious !== null && (
                    <span
                      className={cn(
                        "ml-2",
                        row.fromPrevious < 50 && row.devices > 0 && "text-coral",
                      )}
                      title="Passage depuis l'étape précédente"
                    >
                      {row.fromPrevious} %
                    </span>
                  )}
                </span>
              </div>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-navy"
                  style={{ width: `${row.ofFirst}%` }}
                />
              </div>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}

export default function AdminParcoursPage() {
  const [days, setDays] = useState<number>(30);
  const { data: stats, isLoading, error } = useAdminFunnel(days);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-navy">Parcours</h1>
          <p className="text-[13.5px] text-muted-foreground">
            Où les visiteurs décrochent, et le temps réel du premier devis.
            Comptage par appareil, sans donnée personnelle.
          </p>
        </div>
        <div className="flex gap-1 rounded-xl bg-muted p-1">
          {PERIODS.map((period) => (
            <button
              key={period}
              type="button"
              onClick={() => setDays(period)}
              aria-pressed={days === period}
              className={cn(
                "rounded-lg px-3 py-1.5 text-[13px] font-semibold transition-colors",
                days === period
                  ? "bg-card text-navy shadow-sm"
                  : "text-muted-foreground",
              )}
            >
              {period} j
            </button>
          ))}
        </div>
      </div>

      {error ? (
        <Card>
          <CardContent className="p-5 text-[13.5px] text-muted-foreground">
            Impossible de lire les statistiques du parcours. Vérifiez que la
            migration <code>0038_funnel_events.sql</code> a été exécutée sur
            la base.
          </CardContent>
        </Card>
      ) : isLoading || !stats ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[160px] w-full" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TimingCard
              label="Inscription → premier envoi"
              hint="De l'ouverture de l'inscription au premier document partagé, sur le même appareil. C'est la promesse des 2 minutes."
              median={stats.signup_to_first_share.median_seconds}
              under={stats.signup_to_first_share.under_2_min}
              count={stats.signup_to_first_share.count}
            />
            <TimingCard
              label="Saisie d'un document"
              hint="De l'ouverture du formulaire au clic sur « Générer », pour chaque document créé."
              median={stats.build_time.median_seconds}
              under={stats.build_time.under_2_min}
              count={stats.build_time.count}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <FunnelCard
              title="Parcours avec compte"
              rows={buildFunnel(ACCOUNT_FUNNEL, stats.steps)}
            />
            <div className="space-y-4">
              <FunnelCard
                title="Parcours Express"
                rows={buildFunnel(EXPRESS_FUNNEL, stats.steps)}
              />
              <Card>
                <CardContent className="space-y-2 p-5 text-[13.5px]">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      Express → création de compte
                    </span>
                    <span className="font-semibold text-navy tabular-nums">
                      {stats.steps.express_to_signup ?? 0}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      Bloqués par le quota
                    </span>
                    <span className="font-semibold text-navy tabular-nums">
                      {stats.steps.quota_blocked ?? 0}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
