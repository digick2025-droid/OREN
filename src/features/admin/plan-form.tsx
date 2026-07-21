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
import { Textarea } from "@/components/ui/textarea";
import { useUpdatePlan } from "@/hooks/use-admin-plans";
import type { Plan, PlanFeature, PlanMarketingContent } from "@/types/database";

const FEATURE_LABELS: Record<PlanFeature, string> = {
  catalog: "Catalogue d'articles",
  reports: "Rapports",
  proforma: "Facture proforma",
  logo: "Logo entreprise",
  advance: "Acompte sur facture",
};

const ALL_FEATURES: PlanFeature[] = [
  "catalog",
  "reports",
  "proforma",
  "logo",
  "advance",
];

function emptyMarketing(): PlanMarketingContent {
  return { tag: "", audience: "", features: [] };
}

export function PlanForm({ plan }: { plan: Plan }) {
  const router = useRouter();
  const updatePlan = useUpdatePlan();

  const [name, setName] = useState(plan.name);
  const [priceFcfa, setPriceFcfa] = useState(String(plan.price_fcfa));
  const [monthlyQuota, setMonthlyQuota] = useState(
    plan.monthly_quota != null ? String(plan.monthly_quota) : "",
  );
  const [perDocPrice, setPerDocPrice] = useState(
    plan.per_document_price_fcfa != null
      ? String(plan.per_document_price_fcfa)
      : "",
  );
  const [features, setFeatures] = useState<PlanFeature[]>(plan.features ?? []);
  const [isActive, setIsActive] = useState(plan.is_active);

  const fr = plan.marketing?.fr ?? emptyMarketing();
  const en = plan.marketing?.en ?? emptyMarketing();
  const [tagFr, setTagFr] = useState(fr.tag);
  const [audienceFr, setAudienceFr] = useState(fr.audience);
  const [featuresFr, setFeaturesFr] = useState(fr.features.join("\n"));
  const [tagEn, setTagEn] = useState(en.tag);
  const [audienceEn, setAudienceEn] = useState(en.audience);
  const [featuresEn, setFeaturesEn] = useState(en.features.join("\n"));

  const toggleFeature = (f: PlanFeature) => {
    setFeatures((prev) =>
      prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f],
    );
  };

  const save = () => {
    const price = Number(priceFcfa);
    if (!Number.isFinite(price) || price < 0) {
      toast.error("Entrez un prix valide.");
      return;
    }
    updatePlan.mutate(
      {
        key: plan.key,
        values: {
          name: name.trim(),
          price_fcfa: price,
          monthly_quota: monthlyQuota.trim() ? parseInt(monthlyQuota, 10) : null,
          per_document_price_fcfa: perDocPrice.trim()
            ? parseInt(perDocPrice, 10)
            : null,
          features,
          is_active: isActive,
          marketing: {
            fr: {
              tag: tagFr.trim(),
              audience: audienceFr.trim(),
              features: featuresFr
                .split("\n")
                .map((f) => f.trim())
                .filter(Boolean),
            },
            en: {
              tag: tagEn.trim(),
              audience: audienceEn.trim(),
              features: featuresEn
                .split("\n")
                .map((f) => f.trim())
                .filter(Boolean),
            },
          },
        },
      },
      {
        onSuccess: () => {
          toast.success("Offre mise à jour.");
          router.push("/admin/offres");
        },
        onError: (err) => toast.error(err.message),
      },
    );
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-4 p-5">
          <h2 className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">
            Prix &amp; quotas
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="plan-name">Nom affiché</Label>
              <Input
                id="plan-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="plan-price">Prix mensuel (FCFA)</Label>
              <Input
                id="plan-price"
                inputMode="numeric"
                value={priceFcfa}
                onChange={(e) => setPriceFcfa(e.target.value.replace(/[^\d]/g, ""))}
              />
            </div>
            <div>
              <Label htmlFor="plan-quota">Quota mensuel (documents)</Label>
              <Input
                id="plan-quota"
                inputMode="numeric"
                value={monthlyQuota}
                onChange={(e) =>
                  setMonthlyQuota(e.target.value.replace(/[^\d]/g, ""))
                }
                placeholder="Illimité"
              />
            </div>
            <div>
              <Label htmlFor="plan-perdoc">Prix par document (offre Express)</Label>
              <Input
                id="plan-perdoc"
                inputMode="numeric"
                value={perDocPrice}
                onChange={(e) =>
                  setPerDocPrice(e.target.value.replace(/[^\d]/g, ""))
                }
                placeholder="Laisser vide sinon"
              />
            </div>
          </div>

          <div>
            <Label>Fonctionnalités</Label>
            <div className="flex flex-wrap gap-3">
              {ALL_FEATURES.map((f) => (
                <Checkbox
                  key={f}
                  checked={features.includes(f)}
                  onChange={() => toggleFeature(f)}
                  label={FEATURE_LABELS[f]}
                />
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Switch checked={isActive} onCheckedChange={setIsActive} />
            <span className="text-[14px] font-semibold text-navy">
              Offre active (visible sur /offres)
            </span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 p-5">
          <h2 className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">
            Contenu marketing — Français
          </h2>
          <div>
            <Label htmlFor="tag-fr">Accroche</Label>
            <Input id="tag-fr" value={tagFr} onChange={(e) => setTagFr(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="audience-fr">Cible</Label>
            <Input
              id="audience-fr"
              value={audienceFr}
              onChange={(e) => setAudienceFr(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="features-fr">
              Fonctionnalités affichées (une par ligne)
            </Label>
            <Textarea
              id="features-fr"
              value={featuresFr}
              onChange={(e) => setFeaturesFr(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 p-5">
          <h2 className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">
            Contenu marketing — Anglais
          </h2>
          <div>
            <Label htmlFor="tag-en">Tagline</Label>
            <Input id="tag-en" value={tagEn} onChange={(e) => setTagEn(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="audience-en">Audience</Label>
            <Input
              id="audience-en"
              value={audienceEn}
              onChange={(e) => setAudienceEn(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="features-en">Displayed features (one per line)</Label>
            <Textarea
              id="features-en"
              value={featuresEn}
              onChange={(e) => setFeaturesEn(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Button className="w-full" onClick={save} disabled={updatePlan.isPending}>
        {updatePlan.isPending ? "Enregistrement…" : "Enregistrer"}
      </Button>
    </div>
  );
}
