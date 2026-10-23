"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ScreenHeader } from "@/components/screen-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useClients } from "@/hooks/use-clients";
import { useSaveIntervention } from "@/hooks/use-interventions";
import { useTeamMembers } from "@/hooks/use-team";
import { useCurrentRole } from "@/features/company/company-context";
import { canManageInterventions } from "@/lib/roles";

const SELECT_CLASS =
  "h-[52px] w-full rounded-[14px] border-[1.5px] border-border bg-card px-3 text-[15px] text-navy focus-visible:border-navy focus-visible:outline-none";

export default function NouvelleInterventionPage() {
  const router = useRouter();
  const save = useSaveIntervention();
  const { data: clients } = useClients();
  const { data: members } = useTeamMembers();
  const canManage = canManageInterventions(useCurrentRole());

  const [title, setTitle] = useState("");
  const [clientId, setClientId] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [address, setAddress] = useState("");
  const [description, setDescription] = useState("");

  const submit = () => {
    if (!title.trim()) {
      toast.error("Donnez un objet à l'intervention");
      return;
    }
    save.mutate(
      {
        values: {
          title: title.trim(),
          client_id: clientId || null,
          assigned_to: assignedTo || null,
          scheduled_at: scheduledAt
            ? new Date(scheduledAt).toISOString()
            : null,
          address: address.trim(),
          description: description.trim(),
        },
      },
      {
        onSuccess: (row) => {
          toast.success("Intervention créée");
          router.push(`/interventions/${row.id}`);
        },
        onError: (e) => toast.error(e.message),
      },
    );
  };

  if (!canManage) {
    return (
      <div>
        <ScreenHeader title="Nouvelle intervention" backHref="/interventions" />
        <p className="px-4 pt-6 text-[13.5px] text-muted-foreground">
          Seuls le gérant et le dispatcheur créent des interventions. Les vôtres
          apparaissent dans la liste dès qu&apos;elles vous sont affectées.
        </p>
      </div>
    );
  }

  return (
    <div>
      <ScreenHeader title="Nouvelle intervention" backHref="/interventions" />
      <div className="space-y-5 px-4 pt-5">
        <div>
          <Label htmlFor="iv-title">Objet</Label>
          <Input
            id="iv-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ex. Dépannage climatiseur"
          />
        </div>

        <div>
          <Label htmlFor="iv-client">Client</Label>
          <select
            id="iv-client"
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            className={SELECT_CLASS}
          >
            <option value="">— Aucun —</option>
            {(clients ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <Label htmlFor="iv-assigned">Technicien affecté</Label>
          <select
            id="iv-assigned"
            value={assignedTo}
            onChange={(e) => setAssignedTo(e.target.value)}
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

        <div>
          <Label htmlFor="iv-date">Date prévue</Label>
          <Input
            id="iv-date"
            type="datetime-local"
            value={scheduledAt}
            onChange={(e) => setScheduledAt(e.target.value)}
          />
        </div>

        <div>
          <Label htmlFor="iv-address">Adresse / lieu</Label>
          <Input
            id="iv-address"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Quartier, repère…"
          />
        </div>

        <div>
          <Label htmlFor="iv-desc">Description</Label>
          <textarea
            id="iv-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            className="w-full rounded-[14px] border-[1.5px] border-border bg-card px-3 py-2.5 text-[15px] text-navy focus-visible:border-navy focus-visible:outline-none"
            placeholder="Travaux à réaliser, matériel…"
          />
        </div>

        <Button className="w-full" onClick={submit} disabled={save.isPending}>
          {save.isPending ? "Création…" : "Créer l'intervention"}
        </Button>
      </div>
    </div>
  );
}
