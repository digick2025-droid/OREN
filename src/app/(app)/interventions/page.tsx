"use client";

import Link from "next/link";
import { CalendarClock, CalendarDays, Plus, User } from "lucide-react";
import { ScreenHeader } from "@/components/screen-header";
import { Card } from "@/components/ui/card";
import { useClients } from "@/hooks/use-clients";
import { useInterventions } from "@/hooks/use-interventions";
import { useTeamMembers } from "@/hooks/use-team";
import { useCurrentRole } from "@/features/company/company-context";
import { canManageInterventions } from "@/lib/roles";
import {
  INTERVENTION_STATUS_CLASSES,
  INTERVENTION_STATUS_LABELS,
} from "@/lib/interventions";
import { cn } from "@/lib/utils";

function formatWhen(iso: string | null): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function InterventionsPage() {
  const { data: interventions, isLoading } = useInterventions();
  const { data: members } = useTeamMembers();
  const { data: clients } = useClients();
  const canManage = canManageInterventions(useCurrentRole());

  const memberName = (userId: string | null) => {
    if (!userId) return null;
    const m = members?.find((x) => x.user_id === userId);
    return m ? m.full_name || m.phone || "Technicien" : null;
  };
  const clientName = (clientId: string | null) => {
    if (!clientId) return null;
    return clients?.find((c) => c.id === clientId)?.name ?? null;
  };

  return (
    <div>
      <ScreenHeader
        title="Interventions"
        action={
          <div className="flex items-center gap-1">
            <Link
              href="/interventions/planning"
              aria-label="Planning"
              className="rounded-xl p-1.5 text-navy hover:bg-muted"
            >
              <CalendarDays size={21} />
            </Link>
            {canManage ? (
              <Link
                href="/interventions/nouveau"
                aria-label="Nouvelle intervention"
                className="rounded-xl p-1.5 text-navy hover:bg-muted"
              >
                <Plus size={22} />
              </Link>
            ) : null}
          </div>
        }
      />

      <div className="space-y-3 px-4 pt-4">
        {isLoading ? (
          <p className="px-1 text-[13px] text-muted-foreground">Chargement…</p>
        ) : (interventions ?? []).length === 0 ? (
          <div className="rounded-card border border-dashed border-border px-4 py-10 text-center">
            <p className="text-[14px] font-semibold text-navy">
              Aucune intervention
            </p>
            <p className="mt-1 text-[12.5px] text-muted-foreground">
              {canManage
                ? "Créez votre premier bon d'intervention."
                : "Aucune intervention ne vous est affectée pour le moment."}
            </p>
            {canManage ? (
              <Link
                href="/interventions/nouveau"
                className="mt-4 inline-flex items-center gap-1.5 rounded-field bg-primary px-4 py-2.5 text-[13px] font-semibold text-primary-foreground"
              >
                <Plus size={16} /> Nouvelle intervention
              </Link>
            ) : null}
          </div>
        ) : (
          (interventions ?? []).map((iv) => {
            const who = memberName(iv.assigned_to);
            const client = clientName(iv.client_id);
            const when = formatWhen(iv.scheduled_at);
            return (
              <Link key={iv.id} href={`/interventions/${iv.id}`}>
                <Card className="space-y-2 px-4 py-3.5">
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      {iv.number ? (
                        <div className="text-[11px] font-semibold tracking-wide text-muted-foreground">
                          {iv.number}
                        </div>
                      ) : null}
                      <div className="truncate text-[15px] font-bold text-navy">
                        {iv.title}
                      </div>
                      {client ? (
                        <div className="truncate text-[12.5px] text-muted-foreground">
                          {client}
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
                  </div>
                  {(who || when) && (
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-muted-foreground">
                      {when ? (
                        <span className="inline-flex items-center gap-1">
                          <CalendarClock size={13} /> {when}
                        </span>
                      ) : null}
                      {who ? (
                        <span className="inline-flex items-center gap-1">
                          <User size={13} /> {who}
                        </span>
                      ) : null}
                    </div>
                  )}
                </Card>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}
