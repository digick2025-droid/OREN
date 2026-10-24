"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ScreenHeader } from "@/components/screen-header";
import { TerrainTabs } from "@/components/terrain-tabs";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCurrentRole } from "@/features/company/company-context";
import { useInterventions } from "@/hooks/use-interventions";
import {
  useDeleteExpense,
  useExpenses,
  useSaveExpense,
  useTreasurySummary,
} from "@/hooks/use-expenses";
import { canSeeTreasury } from "@/lib/roles";
import { formatAmount } from "@/lib/format";
import { cn } from "@/lib/utils";

const SELECT_CLASS =
  "h-[52px] w-full rounded-[14px] border-[1.5px] border-border bg-card px-3 text-[15px] text-navy focus-visible:border-navy focus-visible:outline-none";

function toInt(v: string): number {
  const n = Math.round(Number(v.replace(/[^\d]/g, "")));
  return Number.isFinite(n) ? n : 0;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function TreasuryPage() {
  const canSee = canSeeTreasury(useCurrentRole());
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1); // 1-based

  const { data: expenses } = useExpenses(year, month);
  const { data: summary } = useTreasurySummary(year, month);
  const { data: interventions } = useInterventions();
  const saveExpense = useSaveExpense();
  const removeExpense = useDeleteExpense();

  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");
  const [supplier, setSupplier] = useState("");
  const [date, setDate] = useState(today());
  const [interventionId, setInterventionId] = useState("");

  const expensesTotal = useMemo(
    () => (expenses ?? []).reduce((sum, e) => sum + e.amount, 0),
    [expenses],
  );

  if (!canSee) {
    return (
      <div>
        <ScreenHeader title="Trésorerie" backHref="/terrain" />
        <TerrainTabs />
        <p className="px-4 pt-6 text-[13.5px] text-muted-foreground">
          Accès réservé au gérant et au comptable.
        </p>
      </div>
    );
  }

  const billed = summary?.billed ?? 0;
  const collected = summary?.collected ?? 0;
  const partsCost = summary?.partsCost ?? 0;
  const totalCost = expensesTotal + partsCost;
  const margin = billed - totalCost;
  const cash = collected - expensesTotal;

  const prevMonth = () => {
    setMonth((m) => {
      if (m === 1) {
        setYear((y) => y - 1);
        return 12;
      }
      return m - 1;
    });
  };
  const nextMonth = () => {
    setMonth((m) => {
      if (m === 12) {
        setYear((y) => y + 1);
        return 1;
      }
      return m + 1;
    });
  };

  const monthLabel = new Date(year, month - 1, 1).toLocaleDateString("fr-FR", {
    month: "long",
    year: "numeric",
  });

  const resetForm = () => {
    setLabel("");
    setAmount("");
    setCategory("");
    setSupplier("");
    setDate(today());
    setInterventionId("");
  };

  const submit = () => {
    if (!label.trim()) {
      toast.error("Intitulé de la dépense requis");
      return;
    }
    saveExpense.mutate(
      {
        values: {
          label: label.trim(),
          amount: toInt(amount),
          category: category.trim(),
          supplier: supplier.trim(),
          expense_date: date,
          intervention_id: interventionId || null,
        },
      },
      {
        onSuccess: () => {
          toast.success("Dépense enregistrée");
          resetForm();
          setOpen(false);
        },
        onError: (e) => toast.error(e.message),
      },
    );
  };

  const del = (id: string, l: string) => {
    if (!confirm(`Supprimer « ${l} » ?`)) return;
    removeExpense.mutate(id, { onError: (e) => toast.error(e.message) });
  };

  return (
    <div className="pb-10">
      <ScreenHeader
        title="Trésorerie"
        backHref="/terrain"
        action={
          <button
            type="button"
            aria-label="Nouvelle dépense"
            onClick={() => setOpen((v) => !v)}
            className="rounded-xl p-1.5 text-navy hover:bg-muted"
          >
            <Plus size={22} />
          </button>
        }
      />
      <TerrainTabs />

      <div className="px-4 pt-4">
        {/* Mois */}
        <div className="flex items-center justify-between">
          <button
            type="button"
            aria-label="Mois précédent"
            onClick={prevMonth}
            className="rounded-xl p-1.5 text-navy hover:bg-muted"
          >
            <ChevronLeft size={20} />
          </button>
          <span className="text-[14px] font-bold capitalize text-navy">
            {monthLabel}
          </span>
          <button
            type="button"
            aria-label="Mois suivant"
            onClick={nextMonth}
            className="rounded-xl p-1.5 text-navy hover:bg-muted"
          >
            <ChevronRight size={20} />
          </button>
        </div>

        {/* KPI */}
        <div className="mt-4 grid grid-cols-2 gap-2.5">
          <Kpi label="Facturé" value={billed} />
          <Kpi label="Encaissé" value={collected} tone="success" />
          <Kpi label="Dépenses" value={expensesTotal} tone="error" />
          <Kpi label="Coût pièces" value={partsCost} tone="error" />
          <Kpi label="Marge (facturé − coûts)" value={margin} tone="signed" wide />
          <Kpi label="Trésorerie (encaissé − dépenses)" value={cash} tone="signed" wide />
        </div>

        {/* Formulaire dépense */}
        {open ? (
          <Card className="mt-4 space-y-3 px-4 py-4">
            <div>
              <Label htmlFor="ex-label">Intitulé</Label>
              <Input
                id="ex-label"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Ex. Achat gaz R410"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor="ex-amount">Montant (FCFA)</Label>
                <Input
                  id="ex-amount"
                  inputMode="numeric"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0"
                />
              </div>
              <div>
                <Label htmlFor="ex-date">Date</Label>
                <Input
                  id="ex-date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor="ex-cat">Catégorie</Label>
                <Input
                  id="ex-cat"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="Carburant, achat…"
                />
              </div>
              <div>
                <Label htmlFor="ex-supplier">Fournisseur</Label>
                <Input
                  id="ex-supplier"
                  value={supplier}
                  onChange={(e) => setSupplier(e.target.value)}
                  placeholder="Optionnel"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="ex-iv">Intervention liée (optionnel)</Label>
              <select
                id="ex-iv"
                value={interventionId}
                onChange={(e) => setInterventionId(e.target.value)}
                className={SELECT_CLASS}
              >
                <option value="">— Aucune —</option>
                {(interventions ?? []).map((iv) => (
                  <option key={iv.id} value={iv.id}>
                    {iv.number ? `${iv.number} · ` : ""}
                    {iv.title}
                  </option>
                ))}
              </select>
            </div>
            <Button
              className="w-full"
              onClick={submit}
              disabled={saveExpense.isPending}
            >
              {saveExpense.isPending ? "Enregistrement…" : "Enregistrer la dépense"}
            </Button>
          </Card>
        ) : null}

        {/* Liste des dépenses */}
        <h2 className="mt-5 text-[14px] font-bold text-navy">Dépenses du mois</h2>
        <div className="mt-2 space-y-2">
          {(expenses ?? []).length === 0 ? (
            <p className="rounded-card border border-dashed border-border px-4 py-6 text-center text-[13px] text-muted-foreground">
              Aucune dépense enregistrée ce mois.
            </p>
          ) : (
            (expenses ?? []).map((e) => (
              <Card key={e.id} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[14px] font-semibold text-navy">
                    {e.label}
                  </div>
                  <div className="truncate text-[12px] text-muted-foreground">
                    {[
                      new Date(e.expense_date).toLocaleDateString("fr-FR", {
                        day: "2-digit",
                        month: "short",
                      }),
                      e.category,
                      e.supplier,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </div>
                </div>
                <span className="shrink-0 text-[13px] font-bold text-error">
                  −{formatAmount(e.amount)}
                </span>
                <button
                  type="button"
                  aria-label="Supprimer la dépense"
                  onClick={() => del(e.id, e.label)}
                  className="text-muted-foreground hover:text-error"
                >
                  <Trash2 size={15} />
                </button>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function Kpi({
  label,
  value,
  tone = "navy",
  wide = false,
}: {
  label: string;
  value: number;
  tone?: "navy" | "success" | "error" | "signed";
  wide?: boolean;
}) {
  const color =
    tone === "success"
      ? "text-success"
      : tone === "error"
        ? "text-error"
        : tone === "signed"
          ? value >= 0
            ? "text-success"
            : "text-error"
          : "text-navy";
  return (
    <Card className={cn("px-4 py-3", wide && "col-span-2")}>
      <div className="text-[11.5px] font-medium text-muted-foreground">
        {label}
      </div>
      <div className={cn("mt-0.5 text-[16px] font-extrabold", color)}>
        {formatAmount(value)}
      </div>
    </Card>
  );
}
