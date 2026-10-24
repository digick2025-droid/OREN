"use client";

import Link from "next/link";
import { CalendarClock, Plus, RefreshCw } from "lucide-react";
import { ScreenHeader } from "@/components/screen-header";
import { TerrainTabs } from "@/components/terrain-tabs";
import { Card } from "@/components/ui/card";
import { useClients } from "@/hooks/use-clients";
import { useContracts } from "@/hooks/use-contracts";
import { useCurrentRole } from "@/features/company/company-context";
import { canManageInterventions } from "@/lib/roles";
import {
  CONTRACT_FREQUENCY_LABELS,
  CONTRACT_STATUS_CLASSES,
  CONTRACT_STATUS_LABELS,
  isDueSoon,
} from "@/lib/contracts";
import { cn } from "@/lib/utils";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function ContractsPage() {
  const { data: contracts, isLoading } = useContracts();
  const { data: clients } = useClients();
  const canManage = canManageInterventions(useCurrentRole());

  const clientName = (id: string | null) =>
    id ? (clients?.find((c) => c.id === id)?.name ?? null) : null;

  return (
    <div className="pb-10">
      <ScreenHeader
        title="Contrats"
        backHref="/terrain"
        action={
          canManage ? (
            <Link
              href="/contrats/nouveau"
              aria-label="Nouveau contrat"
              className="rounded-xl p-1.5 text-navy hover:bg-muted"
            >
              <Plus size={22} />
            </Link>
          ) : null
        }
      />
      <TerrainTabs />

      <div className="space-y-3 px-4 pt-4">
        {isLoading ? (
          <p className="px-1 text-[13px] text-muted-foreground">Chargement…</p>
        ) : (contracts ?? []).length === 0 ? (
          <div className="rounded-card border border-dashed border-border px-4 py-10 text-center">
            <RefreshCw size={22} className="mx-auto text-muted-foreground" />
            <p className="mt-2 text-[14px] font-semibold text-navy">
              Aucun contrat
            </p>
            <p className="mt-1 text-[12.5px] text-muted-foreground">
              {canManage
                ? "Créez un contrat de maintenance récurrent."
                : "Aucun contrat de maintenance pour le moment."}
            </p>
            {canManage ? (
              <Link
                href="/contrats/nouveau"
                className="mt-4 inline-flex items-center gap-1.5 rounded-field bg-primary px-4 py-2.5 text-[13px] font-semibold text-primary-foreground"
              >
                <Plus size={16} /> Nouveau contrat
              </Link>
            ) : null}
          </div>
        ) : (
          (contracts ?? []).map((ct) => {
            const due = ct.status === "actif" && isDueSoon(ct.next_due);
            return (
              <Link key={ct.id} href={`/contrats/${ct.id}`}>
                <Card className="space-y-2 px-4 py-3.5">
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      {ct.number ? (
                        <div className="text-[11px] font-semibold tracking-wide text-muted-foreground">
                          {ct.number}
                        </div>
                      ) : null}
                      <div className="truncate text-[15px] font-bold text-navy">
                        {ct.title}
                      </div>
                      {clientName(ct.client_id) ? (
                        <div className="truncate text-[12.5px] text-muted-foreground">
                          {clientName(ct.client_id)}
                        </div>
                      ) : null}
                    </div>
                    <span
                      className={cn(
                        "shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold",
                        CONTRACT_STATUS_CLASSES[ct.status],
                      )}
                    >
                      {CONTRACT_STATUS_LABELS[ct.status]}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-muted-foreground">
                    <span>{CONTRACT_FREQUENCY_LABELS[ct.frequency]}</span>
                    <span
                      className={cn(
                        "inline-flex items-center gap-1",
                        due && "font-semibold text-warning",
                      )}
                    >
                      <CalendarClock size={13} /> {formatDate(ct.next_due)}
                    </span>
                  </div>
                </Card>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}
