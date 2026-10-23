"use client";

import { useState } from "react";
import { Minus, Package, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ScreenHeader } from "@/components/screen-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCurrentRole } from "@/features/company/company-context";
import {
  useAdjustStock,
  useDeletePart,
  useParts,
  useSavePart,
} from "@/hooks/use-parts";
import { canManageInterventions } from "@/lib/roles";
import { formatAmount } from "@/lib/format";
import { cn } from "@/lib/utils";

function toInt(v: string): number {
  const n = Math.round(Number(v.replace(/[^\d-]/g, "")));
  return Number.isFinite(n) ? n : 0;
}

export default function StockPage() {
  const { data: parts, isLoading } = useParts();
  const canManage = canManageInterventions(useCurrentRole());
  const savePart = useSavePart();
  const adjust = useAdjustStock();
  const remove = useDeletePart();

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [reference, setReference] = useState("");
  const [unit, setUnit] = useState("u");
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("");
  const [threshold, setThreshold] = useState("");

  const resetForm = () => {
    setName("");
    setReference("");
    setUnit("u");
    setPrice("");
    setStock("");
    setThreshold("");
  };

  const submit = () => {
    if (!name.trim()) {
      toast.error("Donnez un nom à la pièce");
      return;
    }
    savePart.mutate(
      {
        values: {
          name: name.trim(),
          reference: reference.trim(),
          unit: unit.trim() || "u",
          unit_price: toInt(price),
          stock: toInt(stock),
          low_stock_threshold: toInt(threshold),
        },
      },
      {
        onSuccess: () => {
          toast.success("Pièce ajoutée");
          resetForm();
          setOpen(false);
        },
        onError: (e) => toast.error(e.message),
      },
    );
  };

  const bump = (id: string, next: number) => {
    adjust.mutate(
      { id, stock: next },
      { onError: (e) => toast.error(e.message) },
    );
  };

  const del = (id: string, label: string) => {
    if (!confirm(`Supprimer « ${label} » du magasin ?`)) return;
    remove.mutate(id, { onError: (e) => toast.error(e.message) });
  };

  return (
    <div className="pb-10">
      <ScreenHeader
        title="Stock"
        backHref="/interventions"
        action={
          canManage ? (
            <button
              type="button"
              aria-label="Nouvelle pièce"
              onClick={() => setOpen((v) => !v)}
              className="rounded-xl p-1.5 text-navy hover:bg-muted"
            >
              <Plus size={22} />
            </button>
          ) : null
        }
      />

      <div className="space-y-3 px-4 pt-4">
        {canManage && open ? (
          <Card className="space-y-3 px-4 py-4">
            <div>
              <Label htmlFor="pt-name">Nom de la pièce</Label>
              <Input
                id="pt-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex. Compresseur 1,5 CV"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor="pt-ref">Référence</Label>
                <Input
                  id="pt-ref"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  placeholder="SKU / réf."
                />
              </div>
              <div>
                <Label htmlFor="pt-unit">Unité</Label>
                <Input
                  id="pt-unit"
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  placeholder="u, m, L…"
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label htmlFor="pt-price">Coût (FCFA)</Label>
                <Input
                  id="pt-price"
                  inputMode="numeric"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="0"
                />
              </div>
              <div>
                <Label htmlFor="pt-stock">Stock</Label>
                <Input
                  id="pt-stock"
                  inputMode="numeric"
                  value={stock}
                  onChange={(e) => setStock(e.target.value)}
                  placeholder="0"
                />
              </div>
              <div>
                <Label htmlFor="pt-threshold">Seuil</Label>
                <Input
                  id="pt-threshold"
                  inputMode="numeric"
                  value={threshold}
                  onChange={(e) => setThreshold(e.target.value)}
                  placeholder="0"
                />
              </div>
            </div>
            <Button
              className="w-full"
              onClick={submit}
              disabled={savePart.isPending}
            >
              {savePart.isPending ? "Ajout…" : "Ajouter au magasin"}
            </Button>
          </Card>
        ) : null}

        {isLoading ? (
          <p className="px-1 text-[13px] text-muted-foreground">Chargement…</p>
        ) : (parts ?? []).length === 0 ? (
          <div className="rounded-card border border-dashed border-border px-4 py-10 text-center">
            <Package size={22} className="mx-auto text-muted-foreground" />
            <p className="mt-2 text-[14px] font-semibold text-navy">
              Magasin vide
            </p>
            <p className="mt-1 text-[12.5px] text-muted-foreground">
              {canManage
                ? "Ajoutez vos pièces détachées pour suivre le stock."
                : "Aucune pièce enregistrée pour le moment."}
            </p>
          </div>
        ) : (
          (parts ?? []).map((p) => {
            const low = p.stock <= p.low_stock_threshold;
            return (
              <Card key={p.id} className="flex items-center gap-3 px-4 py-3.5">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[14.5px] font-bold text-navy">
                    {p.name}
                  </div>
                  <div className="truncate text-[12px] text-muted-foreground">
                    {[p.reference, formatAmount(p.unit_price) + " / " + p.unit]
                      .filter(Boolean)
                      .join(" · ")}
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  {canManage ? (
                    <button
                      type="button"
                      aria-label="Retirer une unité"
                      onClick={() => bump(p.id, p.stock - 1)}
                      disabled={adjust.isPending}
                      className="rounded-full border border-border p-1 text-navy disabled:opacity-40"
                    >
                      <Minus size={14} />
                    </button>
                  ) : null}
                  <span
                    className={cn(
                      "min-w-[2.5rem] rounded-full px-2.5 py-1 text-center text-[12.5px] font-bold",
                      low
                        ? "bg-error/10 text-error"
                        : "bg-success/10 text-success",
                    )}
                  >
                    {p.stock}
                  </span>
                  {canManage ? (
                    <button
                      type="button"
                      aria-label="Ajouter une unité"
                      onClick={() => bump(p.id, p.stock + 1)}
                      disabled={adjust.isPending}
                      className="rounded-full border border-border p-1 text-navy disabled:opacity-40"
                    >
                      <Plus size={14} />
                    </button>
                  ) : null}
                </div>

                {canManage ? (
                  <button
                    type="button"
                    aria-label="Supprimer la pièce"
                    onClick={() => del(p.id, p.name)}
                    className="text-muted-foreground hover:text-error"
                  >
                    <Trash2 size={16} />
                  </button>
                ) : null}
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
