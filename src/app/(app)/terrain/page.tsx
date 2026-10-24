"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CalendarClock,
  ChevronRight,
  RefreshCw,
  Wallet,
} from "lucide-react";
import { ScreenHeader } from "@/components/screen-header";
import { TerrainTabs } from "@/components/terrain-tabs";
import { Card } from "@/components/ui/card";
import { useCurrentRole } from "@/features/company/company-context";
import { useInterventions } from "@/hooks/use-interventions";
import { useContracts } from "@/hooks/use-contracts";
import { useParts } from "@/hooks/use-parts";
import { useExpenses, useTreasurySummary } from "@/hooks/use-expenses";
import { canManageInterventions, canSeeTreasury } from "@/lib/roles";
import {
  INTERVENTION_STATUS_CLASSES,
  INTERVENTION_STATUS_LABELS,
} from "@/lib/interventions";
import { isDueSoon } from "@/lib/contracts";
import { formatAmount } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { InterventionStatus } from "@/types/database";

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

const ACTIVE_STATUSES: InterventionStatus[] = [
  "a_planifier",
  "planifiee",
  "en_cours",
];

export default function TerrainDashboardPage() {
  const role = useCurrentRole();
  const canManage = canManageInterventions(role);
  const showTreasury = canSeeTreasury(role);

  const now = new Date();
  const { data: interventions } = useInterventions();
  const { data: contracts } = useContracts();
  const { data: parts } = useParts();
  const { data: summary } = useTreasurySummary(
    now.getFullYear(),
    now.getMonth() + 1,
  );
  const { data: expenses } = useExpenses(now.getFullYear(), now.getMonth() + 1);

  const todayKey = dayKey(new Date());

  const statusCounts = useMemo(() => {
    const counts: Record<InterventionStatus, number> = {
      a_planifier: 0,
      planifiee: 0,
      en_cours: 0,
      terminee: 0,
      annulee: 0,
    };
    for (const iv of interventions ?? []) counts[iv.status]++;
    return counts;
  }, [interventions]);

  const todayList = useMemo(
    () =>
      (interventions ?? [])
        .filter(
          (iv) =>
            iv.scheduled_at && dayKey(new Date(iv.scheduled_at)) === todayKey,
        )
        .sort((a, b) =>
          (a.scheduled_at ?? "").localeCompare(b.scheduled_at ?? ""),
        ),
    [interventions, todayKey],
  );

  const dueContracts = useMemo(
    () =>
      (contracts ?? [])
        .filter((c) => c.status === "actif" && isDueSoon(c.next_due))
        .slice(0, 4),
    [contracts],
  );

  const lowStock = useMemo(
    () => (parts ?? []).filter((p) => p.stock <= p.low_stock_threshold),
    [parts],
  );

  const expensesTotal = (expenses ?? []).reduce((s, e) => s + e.amount, 0);
  const margin = (summary?.billed ?? 0) - (expensesTotal + (summary?.partsCost ?? 0));
  const cash = (summary?.collected ?? 0) - expensesTotal;

  return (
    <div className="pb-10">
      <ScreenHeader title="Terrain" />
      <TerrainTabs />

      <div className="space-y-5 px-4 pt-4">
        {/* Interventions */}
        <section>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-[14px] font-bold text-navy">Interventions</h2>
            <Link
              href="/interventions"
              className="text-[12.5px] font-semibold text-primary"
            >
              Tout voir
            </Link>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {ACTIVE_STATUSES.map((s) => (
              <Link key={s} href="/interventions">
                <Card className="px-3 py-3 text-center">
                  <div className="text-[20px] font-extrabold text-navy">
                    {statusCounts[s]}
                  </div>
                  <div
                    className={cn(
                      "mt-1 inline-block rounded-full px-2 py-0.5 text-[10.5px] font-semibold",
                      INTERVENTION_STATUS_CLASSES[s],
                    )}
                  >
                    {INTERVENTION_STATUS_LABELS[s]}
                  </div>
                </Card>
              </Link>
            ))}
          </div>

          <div className="mt-3">
            <div className="mb-1.5 flex items-center gap-1.5 text-[12.5px] font-semibold text-muted-foreground">
              <CalendarClock size={14} /> Aujourd&apos;hui ({todayList.length})
            </div>
            {todayList.length === 0 ? (
              <p className="rounded-card border border-dashed border-border px-4 py-5 text-center text-[12.5px] text-muted-foreground">
                Rien de planifié aujourd&apos;hui.
              </p>
            ) : (
              <div className="space-y-2">
                {todayList.slice(0, 5).map((iv) => (
                  <Link key={iv.id} href={`/interventions/${iv.id}`}>
                    <Card className="flex items-center gap-3 px-3.5 py-2.5">
                      <span className="w-12 shrink-0 text-[12px] font-bold text-navy">
                        {iv.scheduled_at
                          ? new Date(iv.scheduled_at).toLocaleTimeString("fr-FR", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "--:--"}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-[13.5px] font-semibold text-navy">
                        {iv.title}
                      </span>
                      <span
                        className={cn(
                          "shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-semibold",
                          INTERVENTION_STATUS_CLASSES[iv.status],
                        )}
                      >
                        {INTERVENTION_STATUS_LABELS[iv.status]}
                      </span>
                    </Card>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Contrats à échéance */}
        {canManage ? (
          <section>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="flex items-center gap-1.5 text-[14px] font-bold text-navy">
                <RefreshCw size={15} /> Échéances contrats
              </h2>
              <Link
                href="/contrats"
                className="text-[12.5px] font-semibold text-primary"
              >
                Tout voir
              </Link>
            </div>
            {dueContracts.length === 0 ? (
              <p className="rounded-card border border-dashed border-border px-4 py-5 text-center text-[12.5px] text-muted-foreground">
                Aucune échéance proche.
              </p>
            ) : (
              <div className="space-y-2">
                {dueContracts.map((c) => (
                  <Link key={c.id} href={`/contrats/${c.id}`}>
                    <Card className="flex items-center gap-2 px-3.5 py-2.5">
                      <span className="min-w-0 flex-1 truncate text-[13.5px] font-semibold text-navy">
                        {c.title}
                      </span>
                      <span className="shrink-0 text-[12px] font-semibold text-warning">
                        {new Date(c.next_due).toLocaleDateString("fr-FR", {
                          day: "2-digit",
                          month: "short",
                        })}
                      </span>
                      <ChevronRight size={15} className="shrink-0 text-muted-foreground" />
                    </Card>
                  </Link>
                ))}
              </div>
            )}
          </section>
        ) : null}

        {/* Stock bas */}
        {canManage ? (
          <section>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="flex items-center gap-1.5 text-[14px] font-bold text-navy">
                <AlertTriangle size={15} /> Stock bas
              </h2>
              <Link
                href="/stock"
                className="text-[12.5px] font-semibold text-primary"
              >
                Tout voir
              </Link>
            </div>
            {lowStock.length === 0 ? (
              <p className="rounded-card border border-dashed border-border px-4 py-5 text-center text-[12.5px] text-muted-foreground">
                Aucune pièce sous le seuil.
              </p>
            ) : (
              <div className="space-y-2">
                {lowStock.slice(0, 4).map((p) => (
                  <Card
                    key={p.id}
                    className="flex items-center gap-2 px-3.5 py-2.5"
                  >
                    <span className="min-w-0 flex-1 truncate text-[13.5px] font-semibold text-navy">
                      {p.name}
                    </span>
                    <span className="shrink-0 rounded-full bg-error/10 px-2.5 py-1 text-[12px] font-bold text-error">
                      {p.stock} {p.unit}
                    </span>
                  </Card>
                ))}
              </div>
            )}
          </section>
        ) : null}

        {/* Trésorerie du mois */}
        {showTreasury ? (
          <section>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="flex items-center gap-1.5 text-[14px] font-bold text-navy">
                <Wallet size={15} /> Ce mois
              </h2>
              <Link
                href="/tresorerie"
                className="text-[12.5px] font-semibold text-primary"
              >
                Détail
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Card className="px-4 py-3">
                <div className="text-[11.5px] font-medium text-muted-foreground">
                  Marge
                </div>
                <div
                  className={cn(
                    "mt-0.5 text-[16px] font-extrabold",
                    margin >= 0 ? "text-success" : "text-error",
                  )}
                >
                  {formatAmount(margin)}
                </div>
              </Card>
              <Card className="px-4 py-3">
                <div className="text-[11.5px] font-medium text-muted-foreground">
                  Trésorerie
                </div>
                <div
                  className={cn(
                    "mt-0.5 text-[16px] font-extrabold",
                    cash >= 0 ? "text-success" : "text-error",
                  )}
                >
                  {formatAmount(cash)}
                </div>
              </Card>
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}
