"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { toast } from "sonner";
import { Check, ImagePlus, Loader2, Lock, Plus, X } from "lucide-react";
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
import type { Dict } from "@/lib/i18n/dictionaries";
import { usePlanFeature } from "@/hooks/use-usage";
import type { Company, CompanyUpdate, TaxRegime } from "@/types/database";
import { cn } from "@/lib/utils";
import { extractLogoPalette, LOGO_ACCEPT_ATTR, prepareLogo } from "@/lib/upload";
import { Textarea } from "@/components/ui/textarea";
import { PDF_TEMPLATE_IDS, type PdfCompany, type PdfTemplateId } from "@/services/pdf";
import { DocumentPreview } from "./document-preview";

const MAX_SERVICES = 12;
const MAX_SERVICE_LENGTH = 40;
const MAX_FOOTER_NOTE_LENGTH = 200;

interface CompanyFormProps {
  /** Entreprise existante (mode édition) ou null (création) */
  company: Company | null;
  userId: string;
  defaultPhone?: string;
  defaultName?: string;
  defaultOwnerName?: string;
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
  pdf_template: PdfTemplateId;
  doc_services: string[];
  doc_footer_note: string;
}

const TAX_REGIMES: TaxRegime[] = ["reel", "synthetique", "franchise"];

export function CompanyForm({
  company,
  userId,
  defaultPhone,
  defaultName,
  defaultOwnerName,
}: CompanyFormProps) {
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
    name: company?.name ?? defaultName ?? "",
    owner_name: company?.owner_name ?? defaultOwnerName ?? "",
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
    pdf_template: company?.pdf_template ?? "classic",
    doc_services: company?.doc_services ?? [],
    doc_footer_note: company?.doc_footer_note ?? "",
  });
  const [logoPalette, setLogoPalette] = useState<string[]>([]);
  const [serviceDraft, setServiceDraft] = useState("");

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  // Logo déjà enregistré : on retrouve ses couleurs pour les proposer.
  useEffect(() => {
    if (!logoUrl) return;
    let cancelled = false;
    void fetch(logoUrl)
      .then((res) => (res.ok ? res.blob() : null))
      .then((blob) => (blob ? extractLogoPalette(blob) : []))
      .then((palette) => {
        if (!cancelled) setLogoPalette(palette);
      })
      .catch(() => {
        // Logo injoignable : pas de suggestion de couleur, sans gêner l'écran.
      });
    return () => {
      cancelled = true;
    };
  }, [logoUrl]);

  const addService = () => {
    const value = serviceDraft.trim().slice(0, MAX_SERVICE_LENGTH);
    if (!value) return;
    if (form.doc_services.length >= MAX_SERVICES) {
      toast.error(t.footer_services_max);
      return;
    }
    if (!form.doc_services.some((s) => s.toLowerCase() === value.toLowerCase())) {
      setField("doc_services", [...form.doc_services, value]);
    }
    setServiceDraft("");
  };

  const removeService = (index: number) =>
    setField(
      "doc_services",
      form.doc_services.filter((_, i) => i !== index),
    );

  // Entreprise telle que le document la rendra, avec les réglages en cours.
  const previewCompany = useMemo<PdfCompany>(
    () => ({
      name: form.name.trim() || "Mon entreprise",
      ownerName: form.owner_name,
      slogan: brandingAccess.enabled ? form.slogan : "",
      phone: form.phone,
      whatsapp: form.whatsapp,
      address: form.address,
      email: form.email,
      logoUrl: brandingAccess.enabled ? (logoUrl ?? "") : "",
      color: form.color,
      rccm: form.rccm,
      nif: form.nif,
      taxRegime: form.tax_regime,
      premiumBranding: brandingAccess.enabled,
      template: form.pdf_template,
      services: form.doc_services,
      footerNote: form.doc_footer_note,
    }),
    [form, logoUrl, brandingAccess.enabled],
  );

  const customColor = ![...COMPANY_COLORS, ...logoPalette].some((c) =>
    sameColor(c, form.color),
  );

  const uploadLogo = async (file: File) => {
    if (!company) {
      toast.error(t.logo_save_first);
      return;
    }
    // Validation + compression côté client (taille, MIME réel, anti-SVG).
    const prepared = await prepareLogo(file);
    if (!prepared.ok) {
      toast.error(prepared.message);
      return;
    }
    const safeFile = prepared.file;
    setUploading(true);
    // Couleur de document assortie au logo, enregistrée avec lui.
    const palette = await extractLogoPalette(safeFile);
    const logoColor = palette[0];
    const ext = safeFile.name.split(".").pop() ?? "png";
    const path = `${company.id}/logo-${Date.now()}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from("logos")
      .upload(path, safeFile, { upsert: true, contentType: safeFile.type });
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
      .update(logoColor ? { logo_url: publicUrl, color: logoColor } : { logo_url: publicUrl })
      .eq("id", company.id);
    setUploading(false);
    if (updateError) {
      console.error("[logo] update companies:", updateError);
      toast.error(t.toast_save_error);
      return;
    }
    setLogoUrl(publicUrl);
    setLogoPalette(palette);
    if (logoColor) {
      setField("color", logoColor);
      toast.success(t.color_from_logo_toast);
    } else {
      toast.success(t.toast_saved);
    }
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
      pdf_template: form.pdf_template,
      doc_services: form.doc_services,
      doc_footer_note: form.doc_footer_note.trim() || null,
    };

    const result = company
      ? await supabase.from("companies").update(values).eq("id", company.id)
      : await supabase
          .from("companies")
          .insert({ ...values, name: form.name.trim(), owner_id: userId });

    setSaving(false);
    if (result.error) {
      // Numéro déjà utilisé par une autre entreprise (migration 0043).
      toast.error(
        result.error.message.includes("PHONE_TAKEN")
          ? t.toast_phone_taken
          : t.toast_save_error,
      );
      return;
    }
    toast.success(t.toast_saved);
    router.push(company ? "/reglages" : "/nouveau?type=devis");
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
        {logoPalette.length > 0 && (
          <div className="mb-3">
            <div className="mb-1.5 text-[12px] font-semibold text-muted-foreground">
              {t.logo_colors}
            </div>
            <div className="flex gap-2.5">
              {logoPalette.map((color) => (
                <ColorSwatch
                  key={color}
                  color={color}
                  label={`${t.logo_colors} ${color}`}
                  selected={sameColor(form.color, color)}
                  onSelect={() => setField("color", color)}
                />
              ))}
            </div>
          </div>
        )}
        {logoPalette.length > 0 && (
          <div className="mb-1.5 text-[12px] font-semibold text-muted-foreground">
            {t.color_presets}
          </div>
        )}
        <div className="flex flex-wrap gap-2.5">
          {COMPANY_COLORS.map((color) => (
            <ColorSwatch
              key={color}
              color={color}
              label={`${t.f_color} ${color}`}
              selected={sameColor(form.color, color)}
              onSelect={() => setField("color", color)}
            />
          ))}
          <label
            className={cn(
              "relative flex h-9 w-9 cursor-pointer items-center justify-center overflow-hidden rounded-full border-2 border-dashed border-border text-muted-foreground transition-transform",
              customColor &&
                "border-solid border-transparent ring-2 ring-navy ring-offset-2 scale-105",
            )}
            style={customColor ? { backgroundColor: form.color } : undefined}
            title={t.color_custom}
          >
            {!customColor && <Plus size={16} />}
            <input
              type="color"
              aria-label={t.color_custom}
              value={toSixDigitHex(form.color)}
              onChange={(e) => setField("color", e.target.value.toUpperCase())}
              className="absolute inset-0 cursor-pointer opacity-0"
            />
          </label>
        </div>
      </div>

      {/* ----- Modèle de document + aperçu ----- */}
      <div>
        <Label>{t.tpl_title}</Label>
        <p className="-mt-1 mb-2 text-[12px] text-muted-foreground/70">{t.tpl_hint}</p>
        <div className="grid grid-cols-3 gap-2.5">
          {PDF_TEMPLATE_IDS.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setField("pdf_template", id)}
              aria-pressed={form.pdf_template === id}
              className={cn(
                "relative rounded-xl border-[1.5px] bg-card p-2 text-left transition-colors",
                form.pdf_template === id ? "border-primary" : "border-border",
              )}
            >
              <TemplateThumb id={id} color={form.color} />
              <div className="mt-1.5 text-[12.5px] font-semibold text-navy">
                {templateLabel(t, id)}
              </div>
              {form.pdf_template === id && (
                <span className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <Check size={12} strokeWidth={3} />
                </span>
              )}
            </button>
          ))}
        </div>
        <div className="mt-4">
          <div className="text-[13px] font-semibold text-navy">{t.tpl_preview}</div>
          <p className="mb-2 text-[12px] text-muted-foreground/70">{t.tpl_preview_hint}</p>
          <DocumentPreview company={previewCompany} />
        </div>
      </div>

      {/* ----- Image de marque (offre Pro) ----- */}
      {!brandingAccess.loading &&
        (brandingAccess.enabled ? (
          <Card className="p-4">
            <div className="text-[14px] font-bold text-navy">
              {t.branding_title}
            </div>
            <p className="mt-0.5 text-[12px] text-muted-foreground/70">
              {t.branding_hint}
            </p>

            <div className="mt-4 flex items-center gap-4">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-surface">
                {logoUrl ? (
                  <Image
                    src={logoUrl}
                    alt="Logo"
                    width={64}
                    height={64}
                    className="h-16 w-16 object-contain"
                  />
                ) : (
                  <ImagePlus size={22} className="text-muted-foreground/70" />
                )}
              </div>
              <div className="flex-1">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={LOGO_ACCEPT_ATTR}
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void uploadLogo(file);
                    e.target.value = "";
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
                  <p className="mt-1.5 text-[11.5px] text-muted-foreground/70">
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
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted text-navy">
              <Lock size={18} />
            </div>
            <div className="min-w-0 flex-1 text-[12.5px] text-muted-foreground">
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

      {/* ----- Pied de page des documents ----- */}
      <Card className="p-4">
        <div className="text-[14px] font-bold text-navy">{t.footer_title}</div>
        <p className="mt-0.5 text-[12px] text-muted-foreground/70">{t.footer_hint}</p>

        <div className="mt-4">
          <Label htmlFor="service-draft">{t.footer_services}</Label>
          {form.doc_services.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-1.5">
              {form.doc_services.map((service, i) => (
                <span
                  key={`${service}-${i}`}
                  className="inline-flex items-center gap-1 rounded-full border border-border bg-surface py-1 pl-3 pr-1.5 text-[12.5px] font-semibold text-navy"
                >
                  {service}
                  <button
                    type="button"
                    aria-label={`${service} ×`}
                    onClick={() => removeService(i)}
                    className="flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
                  >
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <Input
              id="service-draft"
              value={serviceDraft}
              maxLength={MAX_SERVICE_LENGTH}
              onChange={(e) => setServiceDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addService();
                }
              }}
              placeholder={t.footer_services_ph}
              disabled={form.doc_services.length >= MAX_SERVICES}
            />
            <Button
              type="button"
              variant="outline"
              onClick={addService}
              disabled={!serviceDraft.trim() || form.doc_services.length >= MAX_SERVICES}
            >
              <Plus size={15} /> {t.footer_add}
            </Button>
          </div>
        </div>

        <div className="mt-4">
          <Label htmlFor="footer-note">{t.footer_note}</Label>
          <Textarea
            id="footer-note"
            rows={2}
            maxLength={MAX_FOOTER_NOTE_LENGTH}
            value={form.doc_footer_note}
            onChange={(e) => setField("doc_footer_note", e.target.value)}
            placeholder={t.footer_note_ph}
          />
        </div>
      </Card>

      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="text-[14px] font-bold text-navy">{t.ohada_legal}</div>
        <p className="mt-0.5 text-[12px] text-muted-foreground/70">{t.ohada_hint}</p>

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
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-muted-foreground",
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
          <p className="mt-2 text-[12px] text-muted-foreground/70">{t.tva_off_note}</p>
        )}
      </div>

      <Button className="w-full" onClick={() => void save()} disabled={saving}>
        {saving ? t.saving : t.save}
      </Button>
    </div>
  );
}

/** Compare deux couleurs hex sans tenir compte de la casse. */
function sameColor(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase();
}

/** `#RGB` → `#RRGGBB` (l'input couleur natif n'accepte que 6 chiffres). */
function toSixDigitHex(color: string): string {
  return /^#[0-9a-f]{3}$/i.test(color)
    ? `#${color
        .slice(1)
        .split("")
        .map((c) => c + c)
        .join("")}`
    : color;
}

function ColorSwatch({
  color,
  label,
  selected,
  onSelect,
}: {
  color: string;
  label: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={selected}
      onClick={onSelect}
      className={cn(
        "h-9 w-9 rounded-full border border-black/5 transition-transform",
        selected && "ring-2 ring-navy ring-offset-2 scale-105",
      )}
      style={{ backgroundColor: color }}
    />
  );
}

function templateLabel(t: Dict, id: PdfTemplateId): string {
  return id === "modern" ? t.tpl_modern : id === "elegant" ? t.tpl_elegant : t.tpl_classic;
}

function Bar({ width = "100%" }: { width?: string }) {
  return <div className="h-[3px] rounded-full bg-slate-200" style={{ width }} />;
}

/** Vignette schématique de chaque modèle, à la couleur choisie. */
function TemplateThumb({ id, color }: { id: PdfTemplateId; color: string }) {
  return (
    <div className="aspect-[210/297] w-full overflow-hidden rounded-md border border-border bg-white p-1.5">
      {id === "classic" && (
        <div className="space-y-1">
          <div className="h-[3px] rounded-full" style={{ backgroundColor: color }} />
          <div className="flex justify-between">
            <div className="h-3 w-3 rounded-[3px]" style={{ backgroundColor: color }} />
            <div className="h-[5px] w-6 rounded-sm" style={{ backgroundColor: color }} />
          </div>
          <div className="h-3 rounded-sm" style={{ backgroundColor: color, opacity: 0.12 }} />
          <div className="h-[5px] rounded-t-sm" style={{ backgroundColor: color }} />
          <Bar />
          <Bar />
          <Bar />
          <div className="ml-auto h-[6px] w-1/2 rounded-sm" style={{ backgroundColor: color }} />
        </div>
      )}
      {id === "modern" && (
        <div className="space-y-1">
          <div
            className="-mx-1.5 -mt-1.5 mb-1.5 flex h-7 items-center justify-between px-1.5"
            style={{ backgroundColor: color }}
          >
            <div className="h-3 w-3 rounded-[3px] bg-white" />
            <div className="h-[5px] w-6 rounded-sm bg-white/80" />
          </div>
          <div className="flex gap-1">
            <div className="h-3 flex-1 rounded-sm border border-slate-200" />
            <div className="h-3 flex-1 rounded-sm border border-slate-200" />
          </div>
          <div className="h-[2px]" style={{ backgroundColor: color }} />
          <Bar />
          <div className="h-[3px] rounded-full" style={{ backgroundColor: color, opacity: 0.15 }} />
          <Bar />
          <div className="ml-auto h-[7px] w-1/2 rounded-sm" style={{ backgroundColor: color }} />
        </div>
      )}
      {id === "elegant" && (
        <div className="flex flex-col items-center space-y-1">
          <div className="h-3 w-6 rounded-sm bg-slate-300" />
          <Bar width="60%" />
          <div className="flex w-full items-center gap-1">
            <div className="h-px flex-1" style={{ backgroundColor: color }} />
            <div className="h-[4px] w-5 rounded-sm" style={{ backgroundColor: color }} />
            <div className="h-px flex-1" style={{ backgroundColor: color }} />
          </div>
          <div className="h-px w-full" style={{ backgroundColor: color }} />
          <Bar />
          <Bar />
          <Bar />
          <div className="ml-auto w-1/2 border-t-2 pt-0.5" style={{ borderColor: color }}>
            <Bar />
          </div>
        </div>
      )}
    </div>
  );
}
