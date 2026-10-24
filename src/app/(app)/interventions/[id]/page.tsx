"use client";

import { useParams, useRouter } from "next/navigation";
import { CalendarClock, FileText, MapPin, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ScreenHeader } from "@/components/screen-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  useDeleteIntervention,
  useIntervention,
  useSaveIntervention,
} from "@/hooks/use-interventions";
import { isQuotaError, useCreateDocument } from "@/hooks/use-documents";
import { useClients } from "@/hooks/use-clients";
import { useTeamMembers } from "@/hooks/use-team";
import {
  INTERVENTION_STATUSES,
  INTERVENTION_STATUS_CLASSES,
  INTERVENTION_STATUS_LABELS,
} from "@/lib/interventions";
import { cn } from "@/lib/utils";
import type { InterventionStatus } from "@/types/database";

const SELECT_CLASS =
  "h-[52px] w-full rounded-[14px] border-[1.5px] border-border bg-card px-3 text-[15px] text-navy focus-visible:border-navy focus-visible:outline-none";

export default function InterventionDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { data: intervention, isLoading } = useIntervention(params.id);
  const { data: members } = useTeamMembers();
  const { data: clients } = useClients();
  const save = useSaveIntervention();
  const remove = useDeleteIntervention();
  const createDoc = useCreateDocument();

  if (isLoading) {
    return (
      <div>
        <ScreenHeader title="Intervention" backHref="/interventions" />
        <p className="px-4 pt-6 text-[13px] text-muted-foreground">Chargement…</p>
      </div>
    );
  }

  if (!intervention) {
    return (
      <div>
        <ScreenHeader title="Intervention" backHref="/interventions" />
        <p className="px-4 pt-6 text-[13px] text-muted-foreground">
          Intervention introuvable.
        </p>
      </div>
    );
  }

  const iv = intervention;
  const client = clients?.find((c) => c.id === iv.client_id)?.name ?? null;

  const setStatus = (status: InterventionStatus) => {
    if (status === iv.status) return;
    save.mutate(
      { id: iv.id, values: { status } },
      { onError: (e) => toast.error(e.message) },
    );
  };

  const setAssigned = (userId: string) => {
    save.mutate(
      { id: iv.id, values: { assigned_to: userId || null } },
      {
        onSuccess: () => toast.success("Affectation mise à jour"),
        onError: (e) => toast.error(e.message),
      },
    );
  };

  const del = () => {
    if (!confirm("Supprimer cette intervention ?")) return;
    remove.mutate(iv.id, {
      onSuccess: () => {
        toast.success("Intervention supprimée");
        router.push("/interventions");
      },
      onError: (e) => toast.error(e.message),
    });
  };

  const makeQuote = () => {
    createDoc.mutate(
      {
        type: "devis",
        client_id: iv.client_id,
        title: iv.title,
        note: iv.description,
        conditions: "",
        discount: 0,
        status: "brouillon",
        items: [
          {
            name: iv.title,
            unit: "forfait",
            category: "main_oeuvre",
            quantity: 1,
            unit_price: 0,
          },
        ],
      },
      {
        onSuccess: (doc) => {
          toast.success("Devis créé — complétez les montants");
          router.push(`/documents/${doc.id}/modifier`);
        },
        onError: (e) =>
          toast.error(
            isQuotaError(e) ? "Quota de documents atteint" : e.message,
          ),
      },
    );
  };

  const when = iv.scheduled_at
    ? new Date(iv.scheduled_at).toLocaleString("fr-FR", {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : null;

  return (
    <div>
      <ScreenHeader title="Intervention" backHref="/interventions" />
      <div className="space-y-5 px-4 pt-4">
        <div>
          <h1 className="text-[18px] font-extrabold text-navy">{iv.title}</h1>
          {client ? (
            <p className="text-[13px] text-muted-foreground">{client}</p>
          ) : null}
        </div>

        {(when || iv.address) && (
          <Card className="space-y-2 px-4 py-3.5 text-[13.5px] text-navy">
            {when ? (
              <div className="flex items-center gap-2">
                <CalendarClock size={15} className="text-muted-foreground" />
                {when}
              </div>
            ) : null}
            {iv.address ? (
              <div className="flex items-center gap-2">
                <MapPin size={15} className="text-muted-foreground" />
                {iv.address}
              </div>
            ) : null}
          </Card>
        )}

        {iv.description ? (
          <p className="whitespace-pre-wrap text-[14px] text-navy">
            {iv.description}
          </p>
        ) : null}

        <div>
          <Label>Statut</Label>
          <div className="flex flex-wrap gap-2">
            {INTERVENTION_STATUSES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatus(s)}
                disabled={save.isPending}
                className={cn(
                  "rounded-full px-3 py-1.5 text-[12.5px] font-semibold transition-colors",
                  s === iv.status
                    ? INTERVENTION_STATUS_CLASSES[s]
                    : "bg-muted text-muted-foreground/70",
                )}
              >
                {INTERVENTION_STATUS_LABELS[s]}
              </button>
            ))}
          </div>
        </div>

        <div>
          <Label htmlFor="iv-assigned">Technicien affecté</Label>
          <select
            id="iv-assigned"
            value={iv.assigned_to ?? ""}
            onChange={(e) => setAssigned(e.target.value)}
            disabled={save.isPending}
            className={SELECT_CLASS}
          >
            <option value="">— Non affecté —</option>
            {(members ?? []).map((m) => (
              <option key={m.user_id} value={m.user_id}>
                {m.full_name || m.phone || "Membre"}
              </option>
            ))}
          </select>
        </div>

        <Button
          className="w-full"
          onClick={makeQuote}
          disabled={createDoc.isPending}
        >
          <FileText size={16} />{" "}
          {createDoc.isPending ? "Création…" : "Créer un devis"}
        </Button>

        <Button
          variant="destructive"
          className="w-full"
          onClick={del}
          disabled={remove.isPending}
        >
          <Trash2 size={16} /> Supprimer
        </Button>
      </div>
    </div>
  );
}
