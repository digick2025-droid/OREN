"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ScreenHeader } from "@/components/screen-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useClients } from "@/hooks/use-clients";
import { useSaveContract } from "@/hooks/use-contracts";
import { useTeamMembers } from "@/hooks/use-team";
import {
  CONTRACT_FREQUENCIES,
  CONTRACT_FREQUENCY_LABELS,
} from "@/lib/contracts";
import type { ContractFrequency } from "@/types/database";

const SELECT_CLASS =
  "h-[52px] w-full rounded-[14px] border-[1.5px] border-border bg-card px-3 text-[15px] text-navy focus-visible:border-navy focus-visible:outline-none";

function toInt(v: string): number {
  const n = Math.round(Number(v.replace(/[^\d]/g, "")));
  return Number.isFinite(n) ? n : 0;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function NouveauContratPage() {
  const router = useRouter();
  const save = useSaveContract();
  const { data: clients } = useClients();
  const { data: members } = useTeamMembers();

  const [title, setTitle] = useState("");
  const [clientId, setClientId] = useState("");
  const [frequency, setFrequency] = useState<ContractFrequency>("mensuel");
  const [amount, setAmount] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [startDate, setStartDate] = useState(today());
  const [nextDue, setNextDue] = useState(today());
  const [endDate, setEndDate] = useState("");
  const [description, setDescription] = useState("");

  const submit = () => {
    if (!title.trim()) {
      toast.error("Donnez un objet au contrat");
      return;
    }
    save.mutate(
      {
        values: {
          title: title.trim(),
          client_id: clientId || null,
          frequency,
          amount: toInt(amount),
          assigned_to: assignedTo || null,
          start_date: startDate,
          next_due: nextDue || startDate,
          end_date: endDate || null,
          description: description.trim(),
        },
      },
      {
        onSuccess: (row) => {
          toast.success("Contrat créé");
          router.push(`/contrats/${row.id}`);
        },
        onError: (e) => toast.error(e.message),
      },
    );
  };

  return (
    <div>
      <ScreenHeader title="Nouveau contrat" backHref="/contrats" />
      <div className="space-y-5 px-4 pt-5">
        <div>
          <Label htmlFor="ct-title">Objet</Label>
          <Input
            id="ct-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ex. Entretien climatisation trimestriel"
          />
        </div>

        <div>
          <Label htmlFor="ct-client">Client</Label>
          <select
            id="ct-client"
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

        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label htmlFor="ct-freq">Fréquence</Label>
            <select
              id="ct-freq"
              value={frequency}
              onChange={(e) =>
                setFrequency(e.target.value as ContractFrequency)
              }
              className={SELECT_CLASS}
            >
              {CONTRACT_FREQUENCIES.map((f) => (
                <option key={f} value={f}>
                  {CONTRACT_FREQUENCY_LABELS[f]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="ct-amount">Montant / échéance</Label>
            <Input
              id="ct-amount"
              inputMode="numeric"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
            />
          </div>
        </div>

        <div>
          <Label htmlFor="ct-assigned">Technicien par défaut</Label>
          <select
            id="ct-assigned"
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

        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label htmlFor="ct-start">Début</Label>
            <Input
              id="ct-start"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="ct-next">Prochaine échéance</Label>
            <Input
              id="ct-next"
              type="date"
              value={nextDue}
              onChange={(e) => setNextDue(e.target.value)}
            />
          </div>
        </div>

        <div>
          <Label htmlFor="ct-end">Fin (optionnel)</Label>
          <Input
            id="ct-end"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>

        <div>
          <Label htmlFor="ct-desc">Description</Label>
          <textarea
            id="ct-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full rounded-[14px] border-[1.5px] border-border bg-card px-3 py-2.5 text-[15px] text-navy focus-visible:border-navy focus-visible:outline-none"
            placeholder="Prestations couvertes…"
          />
        </div>

        <Button className="w-full" onClick={submit} disabled={save.isPending}>
          {save.isPending ? "Création…" : "Créer le contrat"}
        </Button>
      </div>
    </div>
  );
}
