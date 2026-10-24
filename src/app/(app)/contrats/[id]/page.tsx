"use client";

import { useParams, useRouter } from "next/navigation";
import { CalendarClock, RefreshCw, Trash2, User, Wallet } from "lucide-react";
import { toast } from "sonner";
import { ScreenHeader } from "@/components/screen-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useClients } from "@/hooks/use-clients";
import {
  useContract,
  useDeleteContract,
  useGenerateContractVisit,
  useSaveContract,
} from "@/hooks/use-contracts";
import { useTeamMembers } from "@/hooks/use-team";
import { useCurrentRole } from "@/features/company/company-context";
import { canManageInterventions } from "@/lib/roles";
import {
  CONTRACT_FREQUENCY_LABELS,
  CONTRACT_STATUSES,
  CONTRACT_STATUS_CLASSES,
  CONTRACT_STATUS_LABELS,
} from "@/lib/contracts";
import { formatAmount } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ContractStatus } from "@/types/database";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

export default function ContractDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { data: contract, isLoading } = useContract(params.id);
  const { data: clients } = useClients();
  const { data: members } = useTeamMembers();
  const save = useSaveContract();
  const remove = useDeleteContract();
  const generate = useGenerateContractVisit();
  const canManage = canManageInterventions(useCurrentRole());

  if (isLoading) {
    return (
      <div>
        <ScreenHeader title="Contrat" backHref="/contrats" />
        <p className="px-4 pt-6 text-[13px] text-muted-foreground">Chargement…</p>
      </div>
    );
  }

  if (!contract) {
    return (
      <div>
        <ScreenHeader title="Contrat" backHref="/contrats" />
        <p className="px-4 pt-6 text-[13px] text-muted-foreground">
          Contrat introuvable.
        </p>
      </div>
    );
  }

  const ct = contract;
  const client = clients?.find((c) => c.id === ct.client_id)?.name ?? null;
  const tech = members?.find((m) => m.user_id === ct.assigned_to);
  const techName = tech ? tech.full_name || tech.phone || "Technicien" : null;

  const setStatus = (status: ContractStatus) => {
    if (status === ct.status) return;
    save.mutate(
      { id: ct.id, values: { status } },
      { onError: (e) => toast.error(e.message) },
    );
  };

  const onGenerate = () => {
    generate.mutate(ct.id, {
      onSuccess: (interventionId) => {
        toast.success("Intervention générée");
        router.push(`/interventions/${interventionId}`);
      },
      onError: (e) => toast.error(e.message),
    });
  };

  const del = () => {
    if (!confirm("Supprimer ce contrat ?")) return;
    remove.mutate(ct.id, {
      onSuccess: () => {
        toast.success("Contrat supprimé");
        router.push("/contrats");
      },
      onError: (e) => toast.error(e.message),
    });
  };

  return (
    <div className="pb-10">
      <ScreenHeader title="Contrat" backHref="/contrats" />
      <div className="space-y-5 px-4 pt-4">
        <div>
          {ct.number ? (
            <p className="text-[11.5px] font-semibold tracking-wide text-muted-foreground">
              {ct.number}
            </p>
          ) : null}
          <h1 className="text-[18px] font-extrabold text-navy">{ct.title}</h1>
          {client ? (
            <p className="text-[13px] text-muted-foreground">{client}</p>
          ) : null}
        </div>

        <Card className="space-y-2.5 px-4 py-3.5 text-[13.5px] text-navy">
          <div className="flex items-center gap-2">
            <RefreshCw size={15} className="text-muted-foreground" />
            {CONTRACT_FREQUENCY_LABELS[ct.frequency]}
          </div>
          <div className="flex items-center gap-2">
            <CalendarClock size={15} className="text-muted-foreground" />
            Prochaine échéance : {formatDate(ct.next_due)}
          </div>
          {ct.amount > 0 ? (
            <div className="flex items-center gap-2">
              <Wallet size={15} className="text-muted-foreground" />
              {formatAmount(ct.amount)} / échéance
            </div>
          ) : null}
          {techName ? (
            <div className="flex items-center gap-2">
              <User size={15} className="text-muted-foreground" />
              {techName}
            </div>
          ) : null}
          <div className="text-[12px] text-muted-foreground">
            Du {formatDate(ct.start_date)}
            {ct.end_date ? ` au ${formatDate(ct.end_date)}` : " · sans fin"}
          </div>
        </Card>

        {ct.description ? (
          <p className="whitespace-pre-wrap text-[14px] text-navy">
            {ct.description}
          </p>
        ) : null}

        {canManage ? (
          <>
            <div>
              <Label>Statut</Label>
              <div className="flex flex-wrap gap-2">
                {CONTRACT_STATUSES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStatus(s)}
                    disabled={save.isPending}
                    className={cn(
                      "rounded-full px-3 py-1.5 text-[12.5px] font-semibold transition-colors",
                      s === ct.status
                        ? CONTRACT_STATUS_CLASSES[s]
                        : "bg-muted text-muted-foreground/70",
                    )}
                  >
                    {CONTRACT_STATUS_LABELS[s]}
                  </button>
                ))}
              </div>
            </div>

            <Button
              className="w-full"
              onClick={onGenerate}
              disabled={generate.isPending || ct.status !== "actif"}
            >
              <RefreshCw size={16} />{" "}
              {generate.isPending
                ? "Génération…"
                : "Générer la prochaine intervention"}
            </Button>
            {ct.status !== "actif" ? (
              <p className="-mt-3 text-[12px] text-muted-foreground">
                Réactivez le contrat pour générer des interventions.
              </p>
            ) : null}

            <Button
              variant="destructive"
              className="w-full"
              onClick={del}
              disabled={remove.isPending}
            >
              <Trash2 size={16} /> Supprimer
            </Button>
          </>
        ) : null}
      </div>
    </div>
  );
}
