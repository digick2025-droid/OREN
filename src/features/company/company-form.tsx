"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { toast } from "sonner";
import { ImagePlus, Loader2, Lock } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useI18n } from "@/features/i18n/language-context";
import { createClient } from "@/lib/supabase/client";
import { COMPANY_COLORS, DEFAULT_COMPANY_COLOR } from "@/lib/constants";
import { regimeLabel } from "@/lib/i18n/labels";
import { usePlanFeature } from "@/hooks/use-usage";
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
  slogan: string;
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

const TAX_REGIMES: TaxRegime[] = ["reel", "synthetique", "franchise"];

export function CompanyForm({ company, userId, defaultPhone }: CompanyFormProps) {
  const router = useRouter();
  const supabase = createClient();
  const { t } = useI18n();
  const brandingAccess = usePlanFeature("logo");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(
    company?.logo_url ?? null,
  );
  const [form, setForm] = useState<FormState>({
    name: company?.name ?? "",
    owner_name: company?.owner_name ?? "",
    slogan: company?.slogan ?? "",
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

  const uploadLogo = async (file: File) => {
    if (!company) {
      toast.error(t.logo_save_first);
      return;
    }
    setUploading(true);
    const ext = file.name.split(".").pop() ?? "png";
    const path = `${company.id}/logo-${Date.now()}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from("logos")
      .upload(path, file, { upsert: true });
    if (uploadError) {
      setUploading(false);
      console.error("[logo] upload storage:", uploadError);
      toast.error(t.toast_save_error);
      return;
    }
    const { data } = supabase.storage.from("logos").getPublicUrl(path);
    const publicUrl = data.publicUrl;
    const { error: updateError } = await supabase
      .from("companies")
      .update({ logo_url: publicUrl })
      .eq("id", company.id);
    setUploading(false);
    if (updateError) {
      console.error("[logo] update companies:", updateError);
      toast.error(t.toast_save_error);
      return;
    }
    setLogoUrl(publicUrl);
    toast.success(t.toast_saved);
    router.refresh();
  };

  const save = async () => {
    if (!form.name.trim()) {
      toast.error(t.toast_need_company);
      return;
    }
    setSaving(true);
    const values: CompanyUpdate = {
      name: form.name.trim(),
      owner_name: form.owner_name.trim() || null,
      slogan: form.slogan.trim() || null,
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
      toast.error(t.toast_save_error);
      return;
    }
    toast.success(t.toast_saved);
    router.push(company ? "/reglages" : "/accueil");
    router.refresh();
  };

  return (
    <div className="space-y-5 px-4 pb-8 pt-5">
      <div>
        <Label htmlFor="name">{t.f_company}</Label>
        <Input
          id="name"
          value={form.name}
          onChange={(e) => setField("name", e.target.value)}
          placeholder="Ets Kamga & Fils"
        />
      </div>
      <div>
        <Label htmlFor="owner_name">{t.f_owner}</Label>
        <Input
          id="owner_name"
          value={form.owner_name}
          onChange={(e) => setField("owner_name", e.target.value)}
          placeholder="Paul Kamga"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="phone">{t.f_phone}</Label>
          <Input
            id="phone"
            inputMode="tel"
            value={form.phone}
            onChange={(e) => setField("phone", e.target.value)}
            placeholder="6 90 00 00 00"
          />
        </div>
        <div>
          <Label htmlFor="whatsapp">{t.f_whatsapp}</Label>
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
        <Label htmlFor="address">{t.f_address}</Label>
        <Input
          id="address"
          value={form.address}
          onChange={(e) => setField("address", e.target.value)}
          placeholder="Akwa, Douala"
        />
      </div>
      <div>
        <Label htmlFor="email">{t.f_email}</Label>
        <Input
          id="email"
          type="email"
          value={form.email}
          onChange={(e) => setField("email", e.target.value)}
          placeholder="contact@entreprise.cm"
        />
      </div>

      <div>
        <Label>{t.f_color}</Label>
        <div className="flex gap-2.5">
          {COMPANY_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              aria-label={`${t.f_color} ${color}`}
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

      {/* ----- Image de marque (offre Startup) ----- */}
      {!brandingAccess.loading &&
        (brandingAccess.enabled ? (
          <Card className="p-4">
            <div className="text-[14px] font-bold text-navy">
              {t.branding_title}
            </div>
            <p className="mt-0.5 text-[12px] text-[#8A93A6]">
              {t.branding_hint}
            </p>

            <div className="mt-4 flex items-center gap-4">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[#E9EBF0] bg-[#F6F7F9]">
                {logoUrl ? (
                  <Image
                    src={logoUrl}
                    alt="Logo"
                    width={64}
                    height={64}
                    className="h-16 w-16 object-contain"
                  />
                ) : (
                  <ImagePlus size={22} className="text-[#A6ADBD]" />
                )}
              </div>
              <div className="flex-1">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void uploadLogo(file);
                  }}
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading || !company}
                >
                  {uploading ? (
                    <>
                      <Loader2 size={15} className="animate-spin" />{" "}
                      {t.logo_uploading}
                    </>
                  ) : (
                    <>
                      <ImagePlus size={15} />{" "}
                      {logoUrl ? t.logo_change : t.logo_upload}
                    </>
                  )}
                </Button>
                {!company && (
                  <p className="mt-1.5 text-[11.5px] text-[#A6ADBD]">
                    {t.logo_save_first}
                  </p>
                )}
              </div>
            </div>

            <div className="mt-4">
              <Label htmlFor="slogan">{t.f_slogan}</Label>
              <Input
                id="slogan"
                value={form.slogan}
                onChange={(e) => setField("slogan", e.target.value)}
                placeholder={t.f_slogan_ph}
              />
            </div>
          </Card>
        ) : (
          <Card className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#EEF0F4] text-navy">
              <Lock size={18} />
            </div>
            <div className="min-w-0 flex-1 text-[12.5px] text-[#5A6377]">
              {t.branding_locked}
            </div>
            <Link
              href="/offres"
              className="shrink-0 text-[12.5px] font-bold text-coral"
            >
              {t.branding_upgrade}
            </Link>
          </Card>
        ))}

      <div className="rounded-2xl border border-[#E9EBF0] bg-white p-4">
        <div className="text-[14px] font-bold text-navy">{t.ohada_legal}</div>
        <p className="mt-0.5 text-[12px] text-[#8A93A6]">{t.ohada_hint}</p>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="rccm">{t.f_rccm}</Label>
            <Input
              id="rccm"
              value={form.rccm}
              onChange={(e) => setField("rccm", e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="nif">{t.f_nif}</Label>
            <Input
              id="nif"
              value={form.nif}
              onChange={(e) => setField("nif", e.target.value)}
            />
          </div>
        </div>

        <div className="mt-4">
          <Label>{t.f_regime}</Label>
          <div className="flex gap-2">
            {TAX_REGIMES.map((value) => (
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
                {regimeLabel(t, value)}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between">
          <span className="text-[14px] font-semibold text-navy">{t.f_tva}</span>
          <Switch
            checked={form.vat_enabled}
            onCheckedChange={(checked) => setField("vat_enabled", checked)}
          />
        </div>
        {form.vat_enabled ? (
          <div className="mt-3">
            <Label htmlFor="vat_rate">{t.f_tva_rate}</Label>
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
          <p className="mt-2 text-[12px] text-[#8A93A6]">{t.tva_off_note}</p>
        )}
      </div>

      <Button className="w-full" onClick={() => void save()} disabled={saving}>
        {saving ? t.saving : t.save}
      </Button>
    </div>
  );
}
