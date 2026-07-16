"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { createClient } from "@/lib/supabase/client";
import {
  COMPANY_COLORS,
  DEFAULT_COMPANY_COLOR,
  TAX_REGIME_LABELS,
} from "@/lib/constants";
import type { Company, CompanyUpdate, TaxRegime } from "@/types/database";
import { cn } from "@/lib/utils";

interface CompanyFormProps {
  /** Entreprise existante (mode édition) ou null (création) */
  company: Company | null;
  userId: string;
  defaultPhone?: string;
}

interface FormState {
  name: string;
  owner_name: string;
  phone: string;
  whatsapp: string;
  address: string;
  email: string;
  color: string;
  rccm: string;
  nif: string;
  tax_regime: TaxRegime;
  vat_enabled: boolean;
  vat_rate: string;
}

export function CompanyForm({ company, userId, defaultPhone }: CompanyFormProps) {
  const router = useRouter();
  const supabase = createClient();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FormState>({
    name: company?.name ?? "",
    owner_name: company?.owner_name ?? "",
    phone: company?.phone ?? defaultPhone ?? "",
    whatsapp: company?.whatsapp ?? defaultPhone ?? "",
    address: company?.address ?? "",
    email: company?.email ?? "",
    color: company?.color ?? DEFAULT_COMPANY_COLOR,
    rccm: company?.rccm ?? "",
    nif: company?.nif ?? "",
    tax_regime: company?.tax_regime ?? "reel",
    vat_enabled: company?.vat_enabled ?? false,
    vat_rate: String(company?.vat_rate ?? 18),
  });

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const save = async () => {
    if (!form.name.trim()) {
      toast.error("Entrez le nom de l'entreprise");
      return;
    }
    setSaving(true);
    const values: CompanyUpdate = {
      name: form.name.trim(),
      owner_name: form.owner_name.trim() || null,
      phone: form.phone.trim() || null,
      whatsapp: form.whatsapp.trim() || null,
      address: form.address.trim() || null,
      email: form.email.trim() || null,
      color: form.color,
      rccm: form.rccm.trim() || null,
      nif: form.nif.trim() || null,
      tax_regime: form.tax_regime,
      vat_enabled: form.vat_enabled,
      vat_rate: Number(form.vat_rate) || 0,
    };

    const result = company
      ? await supabase.from("companies").update(values).eq("id", company.id)
      : await supabase
          .from("companies")
          .insert({ ...values, name: form.name.trim(), owner_id: userId });

    setSaving(false);
    if (result.error) {
      toast.error("Enregistrement impossible. Réessayez.");
      return;
    }
    toast.success("Profil enregistré");
    router.push(company ? "/reglages" : "/accueil");
    router.refresh();
  };

  return (
    <div className="space-y-5 px-4 pb-8 pt-5">
      <div>
        <Label htmlFor="name">Nom de l&apos;entreprise</Label>
        <Input
          id="name"
          value={form.name}
          onChange={(e) => setField("name", e.target.value)}
          placeholder="Ets Kamga & Fils"
        />
      </div>
      <div>
        <Label htmlFor="owner_name">Nom du responsable</Label>
        <Input
          id="owner_name"
          value={form.owner_name}
          onChange={(e) => setField("owner_name", e.target.value)}
          placeholder="Paul Kamga"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="phone">Téléphone</Label>
          <Input
            id="phone"
            inputMode="tel"
            value={form.phone}
            onChange={(e) => setField("phone", e.target.value)}
            placeholder="6 90 00 00 00"
          />
        </div>
        <div>
          <Label htmlFor="whatsapp">WhatsApp</Label>
          <Input
            id="whatsapp"
            inputMode="tel"
            value={form.whatsapp}
            onChange={(e) => setField("whatsapp", e.target.value)}
            placeholder="6 90 00 00 00"
          />
        </div>
      </div>
      <div>
        <Label htmlFor="address">Adresse</Label>
        <Input
          id="address"
          value={form.address}
          onChange={(e) => setField("address", e.target.value)}
          placeholder="Akwa, Douala"
        />
      </div>
      <div>
        <Label htmlFor="email">Email (optionnel)</Label>
        <Input
          id="email"
          type="email"
          value={form.email}
          onChange={(e) => setField("email", e.target.value)}
          placeholder="contact@entreprise.cm"
        />
      </div>

      <div>
        <Label>Couleur principale</Label>
        <div className="flex gap-2.5">
          {COMPANY_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              aria-label={`Couleur ${color}`}
              onClick={() => setField("color", color)}
              className={cn(
                "h-9 w-9 rounded-full transition-transform",
                form.color === color &&
                  "ring-2 ring-navy ring-offset-2 scale-105",
              )}
              style={{ backgroundColor: color }}
            />
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-[#E9EBF0] bg-white p-4">
        <div className="text-[14px] font-bold text-navy">
          Informations légales (OHADA)
        </div>
        <p className="mt-0.5 text-[12px] text-[#8A93A6]">
          Optionnelles — recommandées pour des factures conformes dans
          l&apos;espace OHADA.
        </p>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="rccm">N° RCCM</Label>
            <Input
              id="rccm"
              value={form.rccm}
              onChange={(e) => setField("rccm", e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="nif">NIF / NCC</Label>
            <Input
              id="nif"
              value={form.nif}
              onChange={(e) => setField("nif", e.target.value)}
            />
          </div>
        </div>

        <div className="mt-4">
          <Label>Régime fiscal</Label>
          <div className="flex gap-2">
            {(
              Object.entries(TAX_REGIME_LABELS) as Array<[TaxRegime, string]>
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setField("tax_regime", value)}
                className={cn(
                  "flex-1 rounded-xl border-[1.5px] px-3 py-2.5 text-[13px] font-semibold transition-colors",
                  form.tax_regime === value
                    ? "border-navy bg-navy text-white"
                    : "border-[#E2E5EC] bg-white text-[#5A6377]",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between">
          <span className="text-[14px] font-semibold text-navy">
            Assujetti à la TVA
          </span>
          <Switch
            checked={form.vat_enabled}
            onCheckedChange={(checked) => setField("vat_enabled", checked)}
          />
        </div>
        {form.vat_enabled ? (
          <div className="mt-3">
            <Label htmlFor="vat_rate">Taux de TVA (%)</Label>
            <Input
              id="vat_rate"
              inputMode="numeric"
              value={form.vat_rate}
              onChange={(e) =>
                setField("vat_rate", e.target.value.replace(/[^\d.]/g, ""))
              }
            />
          </div>
        ) : (
          <p className="mt-2 text-[12px] text-[#8A93A6]">
            Non assujetti — mention « TVA non applicable ».
          </p>
        )}
      </div>

      <Button
        className="w-full"
        onClick={() => void save()}
        disabled={saving}
      >
        {saving ? "Enregistrement…" : "Enregistrer"}
      </Button>
    </div>
  );
}
