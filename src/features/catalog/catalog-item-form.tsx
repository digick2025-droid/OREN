"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ScreenHeader } from "@/components/screen-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ITEM_TYPE_LABELS, UNITS } from "@/lib/constants";
import {
  useDeleteCatalogItem,
  useSaveCatalogItem,
} from "@/hooks/use-catalog";
import type { CatalogItem, CatalogItemType } from "@/types/database";
import { cn } from "@/lib/utils";

export function CatalogItemForm({ item }: { item: CatalogItem | null }) {
  const router = useRouter();
  const saveItem = useSaveCatalogItem();
  const deleteItem = useDeleteCatalogItem();
  const [name, setName] = useState(item?.name ?? "");
  const [price, setPrice] = useState(item ? String(item.unit_price) : "");
  const [unit, setUnit] = useState(item?.unit ?? "unité");
  const [type, setType] = useState<CatalogItemType>(item?.type ?? "prestation");

  const save = () => {
    if (!name.trim()) {
      toast.error("Entrez un nom");
      return;
    }
    const unitPrice = parseInt(price, 10);
    if (!Number.isFinite(unitPrice) || unitPrice < 0) {
      toast.error("Entrez un prix unitaire valide");
      return;
    }
    saveItem.mutate(
      {
        id: item?.id,
        values: { name: name.trim(), unit_price: unitPrice, unit, type },
      },
      {
        onSuccess: () => {
          toast.success("Article enregistré");
          router.push("/catalogue");
        },
        onError: () => toast.error("Enregistrement impossible"),
      },
    );
  };

  const remove = () => {
    if (!item) return;
    deleteItem.mutate(item.id, {
      onSuccess: () => {
        toast.success("Supprimé");
        router.push("/catalogue");
      },
      onError: () => toast.error("Suppression impossible"),
    });
  };

  return (
    <div>
      <ScreenHeader
        title={item ? "Modifier l'article" : "Nouvel article"}
        backHref="/catalogue"
      />
      <div className="space-y-5 px-4 pt-5">
        <div>
          <Label htmlFor="item-name">Nom de l&apos;article</Label>
          <Input
            id="item-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Pose prise électrique"
          />
        </div>

        <div>
          <Label>Type</Label>
          <div className="flex gap-2">
            {(
              Object.entries(ITEM_TYPE_LABELS) as Array<
                [CatalogItemType, string]
              >
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setType(value)}
                className={cn(
                  "flex-1 rounded-xl border-[1.5px] px-3 py-2.5 text-[13px] font-semibold transition-colors",
                  type === value
                    ? "border-navy bg-navy text-white"
                    : "border-[#E2E5EC] bg-white text-[#5A6377]",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="item-price">Prix unitaire (FCFA)</Label>
            <Input
              id="item-price"
              inputMode="numeric"
              value={price}
              onChange={(e) => setPrice(e.target.value.replace(/[^\d]/g, ""))}
              placeholder="5 000"
            />
          </div>
          <div>
            <Label htmlFor="item-unit">Unité</Label>
            <select
              id="item-unit"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              className="h-[52px] w-full rounded-[14px] border-[1.5px] border-[#E2E5EC] bg-white px-3 text-[15px] text-navy focus-visible:outline-none focus-visible:border-navy"
            >
              {UNITS.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </div>
        </div>

        <Button className="w-full" onClick={save} disabled={saveItem.isPending}>
          {saveItem.isPending ? "Enregistrement…" : "Enregistrer"}
        </Button>

        {item && (
          <Button
            variant="destructive"
            className="w-full"
            onClick={remove}
            disabled={deleteItem.isPending}
          >
            Supprimer
          </Button>
        )}
      </div>
    </div>
  );
}
