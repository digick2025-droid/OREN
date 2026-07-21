"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  useCreatePromoCode,
  useUpdatePromoCode,
  type PromoCode,
  type PromoDiscountType,
} from "@/hooks/use-admin-promo-codes";
import { usePlans } from "@/hooks/use-usage";
import { cn } from "@/lib/utils";

function toDateInputValue(iso: string | null): string {
  if (!iso) return "";
  return iso.slice(0, 10);
}

/** Formulaire page dédiée (créer/éditer un code promo), même patron que catalog-item-form. */
export function PromoCodeForm({ promo }: { promo?: PromoCode }) {
  const router = useRouter();
  const { data: plans } = usePlans();
  const createPromo = useCreatePromoCode();
  const updatePromo = useUpdatePromoCode();

  const [code, setCode] = useState(promo?.code ?? "");
  const [description, setDescription] = useState(promo?.description ?? "");
  const [discountType, setDiscountType] = useState<PromoDiscountType>(
    promo?.discount_type ?? "percent",
  );
  const [discountValue, setDiscountValue] = useState(
    promo ? String(promo.discount_value) : "",
  );
  const [applicablePlans, setApplicablePlans] = useState<string[]>(
    promo?.applicable_plans ?? [],
  );
  const [maxRedemptions, setMaxRedemptions] = useState(
    promo?.max_redemptions != null ? String(promo.max_redemptions) : "",
  );
  const [startsAt, setStartsAt] = useState(toDateInputValue(promo?.starts_at ?? null));
  const [expiresAt, setExpiresAt] = useState(toDateInputValue(promo?.expires_at ?? null));
  const [isActive, setIsActive] = useState(promo?.is_active ?? true);

  const payingPlans = (plans ?? []).filter((p) => p.price_fcfa > 0);
  const pending = createPromo.isPending || updatePromo.isPending;

  const togglePlan = (key: string) => {
    setApplicablePlans((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );
  };

  const save = () => {
    if (!code.trim()) {
      toast.error("Entrez un code.");
      return;
    }
    const value = Number(discountValue);
    if (!Number.isFinite(value) || value <= 0) {
      toast.error("Entrez une réduction valide.");
      return;
    }
    const values = {
      code: code.trim(),
      description: description.trim(),
      discount_type: discountType,
      discount_value: value,
      applicable_plans: applicablePlans.length > 0 ? applicablePlans : null,
      max_redemptions: maxRedemptions.trim() ? parseInt(maxRedemptions, 10) : null,
      starts_at: startsAt ? new Date(startsAt).toISOString() : null,
      expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
      is_active: isActive,
    };

    if (promo) {
      updatePromo.mutate(
        { id: promo.id, values },
        {
          onSuccess: () => {
            toast.success("Code promo mis à jour.");
            router.push("/admin/promos");
          },
          onError: (err) => toast.error(err.message),
        },
      );
    } else {
      createPromo.mutate(values, {
        onSuccess: () => {
          toast.success("Code promo créé.");
          router.push("/admin/promos");
        },
        onError: (err) => toast.error(err.message),
      });
    }
  };

  return (
    <Card>
      <CardContent className="space-y-5 p-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="promo-code">Code</Label>
            <Input
              id="promo-code"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="BIENVENUE10"
            />
          </div>
          <div>
            <Label htmlFor="promo-desc">Description (interne)</Label>
            <Input
              id="promo-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Campagne rentrée 2026"
            />
          </div>
        </div>

        <div>
          <Label>Réduction</Label>
          <div className="flex gap-2">
            {(["percent", "fixed"] as PromoDiscountType[]).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setDiscountType(v)}
                className={cn(
                  "flex-1 rounded-field border-[1.5px] px-3 py-2.5 text-[13px] font-semibold transition-colors",
                  discountType === v
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-muted-foreground",
                )}
              >
                {v === "percent" ? "Pourcentage" : "Montant fixe (FCFA)"}
              </button>
            ))}
          </div>
          <Input
            className="mt-2"
            inputMode="numeric"
            value={discountValue}
            onChange={(e) => setDiscountValue(e.target.value.replace(/[^\d]/g, ""))}
            placeholder={discountType === "percent" ? "10" : "1000"}
          />
        </div>

        <div>
          <Label>Offres concernées</Label>
          <div className="flex flex-wrap gap-3">
            {payingPlans.map((p) => (
              <Checkbox
                key={p.key}
                checked={applicablePlans.includes(p.key)}
                onChange={() => togglePlan(p.key)}
                label={p.name}
              />
            ))}
          </div>
          <p className="mt-1 text-[12px] text-muted-foreground">
            Aucune case cochée = valable sur toutes les offres payantes.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <Label htmlFor="promo-max">Utilisations max</Label>
            <Input
              id="promo-max"
              inputMode="numeric"
              value={maxRedemptions}
              onChange={(e) =>
                setMaxRedemptions(e.target.value.replace(/[^\d]/g, ""))
              }
              placeholder="Illimité"
            />
          </div>
          <div>
            <Label htmlFor="promo-start">Début (optionnel)</Label>
            <Input
              id="promo-start"
              type="date"
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="promo-end">Expiration (optionnel)</Label>
            <Input
              id="promo-end"
              type="date"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Switch checked={isActive} onCheckedChange={setIsActive} />
          <span className="text-[14px] font-semibold text-navy">Actif</span>
        </div>

        {promo ? (
          <p className="text-[12.5px] text-muted-foreground">
            {promo.redemption_count} utilisation
            {promo.redemption_count > 1 ? "s" : ""}
            {promo.max_redemptions != null ? ` / ${promo.max_redemptions}` : ""}
          </p>
        ) : null}

        <Button className="w-full" onClick={save} disabled={pending}>
          {pending ? "Enregistrement…" : promo ? "Enregistrer" : "Créer le code"}
        </Button>
      </CardContent>
    </Card>
  );
}
