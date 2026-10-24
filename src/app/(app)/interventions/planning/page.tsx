"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CalendarClock, ChevronLeft, ChevronRight, User } from "lucide-react";
import { ScreenHeader } from "@/components/screen-header";
import { TerrainTabs } from "@/components/terrain-tabs";
import { Card } from "@/components/ui/card";
import { useClients } from "@/hooks/use-clients";
import { useInterventions } from "@/hooks/use-interventions";
import { useTeamMembers } from "@/hooks/use-team";
import {
  INTERVENTION_STATUS_CLASSES,
  INTERVENTION_STATUS_LABELS,
} from "@/lib/interventions";
import { cn } from "@/lib/utils";
import type { Intervention } from "@/types/database";

const WEEKDAY_LETTERS = ["L", "M", "M", "J", "V", "S", "D"];

/** Clé locale AAAA-MM-JJ (comparaison par jour, fuseau de l'appareil). */
function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

function startOfWeek(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const offset = (x.getDay() + 6) % 7; // 0 = lundi
  x.setDate(x.getDate() - offset);
  return x;
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function PlanningPage() {
  const { data: interventions, isLoading } = useInterventions();
  const { data: members } = useTeamMembers();
  const { data: clients } = useClients();

  const [selected, setSelected] = useState<Date>(() => {
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    return t;
  });

  const todayKey = dayKey(new Date());
  const weekStart = useMemo(() => startOfWeek(selected), [selected]);
  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  );

  // Interventions planifiées regroupées par jour (clé locale).
  const scheduledByDay = useMemo(() => {
    const map = new Map<string, Intervention[]>();
    for (const iv of interventions ?? []) {
      if (!iv.scheduled_at) continue;
      const key = dayKey(new Date(iv.scheduled_at));
      const list = map.get(key) ?? [];
      list.push(iv);
      map.set(key, list);
    }
    return map;
  }, [interventions]);

  const unplannedCount = useMemo(
    () => (interventions ?? []).filter((iv) => !iv.scheduled_at).length,
    [interventions],
  );

  const selectedKey = dayKey(selected);
  const dayList = useMemo(
    () =>
      [...(scheduledByDay.get(selectedKey) ?? [])].sort(
        (a, b) => (a.scheduled_at ?? "").localeCompare(b.scheduled_at ?? ""),
      ),
    [scheduledByDay, selectedKey],
  );

  const clientName = (id: string | null) =>
    id ? (clients?.find((c) => c.id === id)?.name ?? null) : null;

  // Groupes par technicien : membres affectés d'abord (ordre de l'équipe),
  // « Non affecté » en dernier.
  const groups = useMemo(() => {
    const byUser = new Map<string, Intervention[]>();
    const unassigned: Intervention[] = [];
    for (const iv of dayList) {
      if (iv.assigned_to) {
        const list = byUser.get(iv.assigned_to) ?? [];
        list.push(iv);
        byUser.set(iv.assigned_to, list);
      } else {
        unassigned.push(iv);
      }
    }
    const ordered: { key: string; label: string; items: Intervention[] }[] = [];
    for (const m of members ?? []) {
      const items = byUser.get(m.user_id);
      if (items && items.length > 0) {
        ordered.push({
          key: m.user_id,
          label: m.full_name || m.phone || "Technicien",
          items,
        });
        byUser.delete(m.user_id);
      }
    }
    // Technicien affecté mais absent de la liste d'équipe (sécurité).
    for (const [userId, items] of byUser) {
      ordered.push({ key: userId, label: "Technicien", items });
    }
    if (unassigned.length > 0) {
      ordered.push({ key: "none", label: "Non affecté", items: unassigned });
    }
    return ordered;
  }, [dayList, members]);

  const fullDayLabel = selected.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <div className="pb-10">
      <ScreenHeader title="Planning" backHref="/terrain" />
      <TerrainTabs />

      <div className="px-4 pt-4">
        {/* Navigation semaine */}
        <div className="flex items-center justify-between">
          <button
            type="button"
            aria-label="Semaine précédente"
            onClick={() => setSelected((d) => addDays(d, -7))}
            className="rounded-xl p-1.5 text-navy hover:bg-muted"
          >
            <ChevronLeft size={20} />
          </button>
          <span className="text-[13px] font-semibold text-navy">
            {weekStart.toLocaleDateString("fr-FR", {
              day: "numeric",
              month: "short",
            })}{" "}
            –{" "}
            {addDays(weekStart, 6).toLocaleDateString("fr-FR", {
              day: "numeric",
              month: "short",
            })}
          </span>
          <button
            type="button"
            aria-label="Semaine suivante"
            onClick={() => setSelected((d) => addDays(d, 7))}
            className="rounded-xl p-1.5 text-navy hover:bg-muted"
          >
            <ChevronRight size={20} />
          </button>
        </div>

        {/* Bande des 7 jours */}
        <div className="mt-3 grid grid-cols-7 gap-1">
          {weekDays.map((d, i) => {
            const key = dayKey(d);
            const count = scheduledByDay.get(key)?.length ?? 0;
            const isSelected = key === selectedKey;
            const isToday = key === todayKey;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setSelected(d)}
                className={cn(
                  "flex flex-col items-center gap-0.5 rounded-[12px] py-2 transition-colors",
                  isSelected
                    ? "bg-navy text-white"
                    : "text-navy hover:bg-muted",
                )}
              >
                <span
                  className={cn(
                    "text-[10px] font-semibold",
                    isSelected ? "text-white/70" : "text-muted-foreground",
                  )}
                >
                  {WEEKDAY_LETTERS[i]}
                </span>
                <span
                  className={cn(
                    "flex h-7 w-7 items-center justify-center rounded-full text-[13.5px] font-bold",
                    isToday && !isSelected && "ring-1 ring-navy",
                  )}
                >
                  {d.getDate()}
                </span>
                <span
                  className={cn(
                    "h-1.5 w-1.5 rounded-full",
                    count > 0
                      ? isSelected
                        ? "bg-white"
                        : "bg-primary"
                      : "bg-transparent",
                  )}
                />
              </button>
            );
          })}
        </div>

        {/* Jour sélectionné */}
        <div className="mt-5 flex items-baseline justify-between">
          <h2 className="text-[15px] font-bold capitalize text-navy">
            {fullDayLabel}
          </h2>
          <span className="text-[12px] text-muted-foreground">
            {dayList.length} intervention{dayList.length > 1 ? "s" : ""}
          </span>
        </div>

        <div className="mt-3 space-y-5">
          {isLoading ? (
            <p className="text-[13px] text-muted-foreground">Chargement…</p>
          ) : dayList.length === 0 ? (
            <div className="rounded-card border border-dashed border-border px-4 py-8 text-center text-[13px] text-muted-foreground">
              Aucune intervention planifiée ce jour.
            </div>
          ) : (
            groups.map((g) => (
              <div key={g.key}>
                <div className="mb-2 flex items-center gap-1.5 text-[12.5px] font-semibold text-muted-foreground">
                  <User size={13} /> {g.label}
                </div>
                <div className="space-y-2">
                  {g.items.map((iv) => (
                    <Link key={iv.id} href={`/interventions/${iv.id}`}>
                      <Card className="flex items-center gap-3 px-3.5 py-3">
                        <div className="flex w-12 shrink-0 flex-col items-center">
                          <CalendarClock
                            size={14}
                            className="text-muted-foreground"
                          />
                          <span className="mt-0.5 text-[12px] font-bold text-navy">
                            {iv.scheduled_at ? timeLabel(iv.scheduled_at) : "--:--"}
                          </span>
                        </div>
                        <div className="min-w-0 flex-1">
                          {iv.number ? (
                            <div className="text-[10.5px] font-semibold tracking-wide text-muted-foreground">
                              {iv.number}
                            </div>
                          ) : null}
                          <div className="truncate text-[14px] font-bold text-navy">
                            {iv.title}
                          </div>
                          {clientName(iv.client_id) ? (
                            <div className="truncate text-[12px] text-muted-foreground">
                              {clientName(iv.client_id)}
                            </div>
                          ) : null}
                        </div>
                        <span
                          className={cn(
                            "shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold",
                            INTERVENTION_STATUS_CLASSES[iv.status],
                          )}
                        >
                          {INTERVENTION_STATUS_LABELS[iv.status]}
                        </span>
                      </Card>
                    </Link>
                  ))}
                </div>
              </div>
            ))
          )}

          {unplannedCount > 0 ? (
            <Link
              href="/interventions"
              className="block rounded-card border border-dashed border-border px-4 py-3 text-center text-[12.5px] font-medium text-muted-foreground"
            >
              {unplannedCount} intervention{unplannedCount > 1 ? "s" : ""} sans
              date — voir la liste
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}
