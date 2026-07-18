"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ScreenHeader } from "@/components/screen-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/features/i18n/language-context";
import { UNITS } from "@/lib/constants";
import { itemTypeLabel } from "@/lib/i18n/labels";
import {
  useDeleteCatalogItem,
  useSaveCatalogItem,
} from "@/hooks/use-catalog";
import type { CatalogItem, CatalogItemType } from "@/types/database";
import { cn } from "@/lib/utils";

const ITEM_TYPES: CatalogItemType[] = ["produit", "prestation"];

export function CatalogItemForm({ item }: { item: CatalogItem | null }) {
  const router = useRouter();
  const { t } = useI18n();
  const saveItem = useSaveCatalogItem();
  const deleteItem = useDeleteCatalogItem();
  const [name, setName] = useState(item?.name ?? "");
  const [price, setPrice] = useState(item ? String(item.unit_price) : "");
  const [unit, setUnit] = useState(item?.unit ?? "unité");
  const [type, setType] = useState<CatalogItemType>(item?.type ?? "prestation");

  const save = () => {
    if (!name.trim()) {
      toast.error(t.toast_need_name);
      return;
    }
    const unitPrice = parseInt(price, 10);
    if (!Number.isFinite(unitPrice) || unitPrice < 0) {
      toast.error(t.toast_need_price);
      return;
    }
    saveItem.mutate(
      {
        id: item?.id,
        values: { name: name.trim(), unit_price: unitPrice, unit, type },
      },
      {
        onSuccess: () => {
          toast.success(t.toast_article_saved);
          router.push("/catalogue");
        },
        onError: () => toast.error(t.toast_save_error),
      },
    );
  };

  const remove = () => {
    if (!item) return;
    deleteItem.mutate(item.id, {
      onSuccess: () => {
        toast.success(t.toast_deleted);
        router.push("/catalogue");
      },
      onError: () => toast.error(t.toast_delete_error),
    });
  };

  return (
    <div>
      <ScreenHeader
        title={item ? t.art_edit : t.art_new}
        backHref="/catalogue"
      />
      <div className="space-y-5 px-4 pt-5">
        <div>
          <Label htmlFor="item-name">{t.f_artname}</Label>
          <Input
            id="item-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div>
          <Label>{t.f_type}</Label>
          <div className="flex gap-2">
            {ITEM_TYPES.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setType(value)}
                className={cn(
                  "flex-1 rounded-xl border-[1.5px] px-3 py-2.5 text-[13px] font-semibold transition-colors",
                  type === value
                    ? "border-navy bg-navy text-white"
                    : "border-border bg-card text-muted-foreground",
                )}
              >
                {itemTypeLabel(t, value)}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="item-price">{t.f_price}</Label>
            <Input
              id="item-price"
              inputMode="numeric"
              value={price}
              onChange={(e) => setPrice(e.target.value.replace(/[^\d]/g, ""))}
              placeholder="5 000"
            />
          </div>
          <div>
            <Label htmlFor="item-unit">{t.f_unit}</Label>
            <select
              id="item-unit"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              className="h-[52px] w-full rounded-[14px] border-[1.5px] border-border bg-card px-3 text-[15px] text-navy focus-visible:outline-none focus-visible:border-navy"
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
          {saveItem.isPending ? t.saving : t.save}
        </Button>

        {item && (
          <Button
            variant="destructive"
            className="w-full"
            onClick={remove}
            disabled={deleteItem.isPending}
          >
            {t.delete}
          </Button>
        )}
      </div>
    </div>
  );
}
