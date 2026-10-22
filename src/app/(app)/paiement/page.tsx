"use client";

import { use, useState } from "react";
import { redirect, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Tag, X } from "lucide-react";
import { ScreenHeader } from "@/components/screen-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PaymentForm } from "@/features/payments/payment-form";
import { useI18n } from "@/features/i18n/language-context";
import { usePlans } from "@/hooks/use-usage";
import { FREE_LAUNCH } from "@/lib/billing";
import { createClient } from "@/lib/supabase/client";
import { formatAmount } from "@/lib/format";
import { annualPrice } from "@/lib/pricing";
import { cn } from "@/lib/utils";

interface PromoPreview {
  valid: boolean;
  reason: string | null;
  promo_code_id: string | null;
  discount_fcfa: number | null;
  final_amount_fcfa: number | null;
}

const PROMO_REASON_LABEL: Record<string, string> = {
  NOT_FOUND: "Code introuvable.",
  INACTIVE: "Ce code n'est plus actif.",
  NOT_STARTED: "Ce code n'est pas encore valable.",
  EXPIRED: "Ce code a expiré.",
  PLAN_NOT_ELIGIBLE: "Ce code ne s'applique pas à cette offre.",
  LIMIT_REACHED: "Ce code a atteint sa limite d'utilisation.",
  ALREADY_USED: "Vous avez déjà utilisé ce code.",
  EMPTY: "Entrez un code.",
  INVALID_PLAN: "Offre invalide.",
};

export default function PaiementPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string; periode?: string }>;
}) {
  const { plan: planKey, periode } = use(searchParams);
  const [billing, setBilling] = useState<"monthly" | "annual">(
    periode === "annuel" ? "annual" : "monthly",
  );
  const router = useRouter();
  const queryClient = useQueryClient();
  const { t } = useI18n();
  const { data: plans } = usePlans();
  const [promoInput, setPromoInput] = useState("");
  const [checkingPromo, setCheckingPromo] = useState(false);
  const [promo, setPromo] = useState<{ code: string; preview: PromoPreview } | null>(
    null,
  );

  // Aucun écran de paiement pendant le lancement gratuit. Plus rien ne mène
  // ici, mais un favori ou un onglet ouvert avant le déploiement y arriverait
  // encore : on renvoie vers /offres, qui explique la gratuité, au lieu
  // d'afficher un formulaire de paiement mort. Placé APRÈS tous les hooks,
  // pour ne pas en rendre l'appel conditionnel.
  if (FREE_LAUNCH) redirect("/offres");

  const plan = (plans ?? []).find((p) => p.key === planKey);

  const applyPromo = async () => {
    if (!plan || !promoInput.trim()) return;
    setCheckingPromo(true);
    const supabase = createClient();
    const { data, error } = await supabase.rpc("preview_promo_code", {
      p_code: promoInput.trim(),
      p_plan_key: plan.key,
    });
    setCheckingPromo(false);
    if (error) {
      toast.error(t.promo_invalid_default);
      return;
    }
    const preview = data as PromoPreview;
    if (!preview.valid) {
      toast.error(
        (preview.reason && PROMO_REASON_LABEL[preview.reason]) ||
          t.promo_invalid_default,
      );
      return;
    }
    setPromo({ code: promoInput.trim(), preview });
  };

  const removePromo = () => {
    setPromo(null);
    setPromoInput("");
  };

  const annual = billing === "annual";
  const amount = annual
    ? annualPrice(plan?.price_fcfa ?? 0)
    : (promo?.preview.final_amount_fcfa ?? plan?.price_fcfa ?? 0);

  return (
    <div>
      <ScreenHeader title={t.pay_title} backHref="/offres" />
      <div className="px-4 pt-4">
        {plan ? (
          <>
            <p className="pb-4 text-[14px] text-muted-foreground">
              {t.pay_sub_prefix}{" "}
              <span className="font-bold text-navy">{plan.name}</span>
            </p>

            {/* Mensuel ou annuel : l'annuel (2 mois offerts) encaisse d'avance
                chez les fidèles, sans rien imposer aux autres. */}
            {plan.price_fcfa > 0 ? (
              <div className="mb-4 grid grid-cols-2 gap-2 rounded-xl bg-muted p-1">
                {(["monthly", "annual"] as const).map((option) => (
                  <button
                    key={option}
                    type="button"
                    aria-pressed={billing === option}
                    onClick={() => {
                      setBilling(option);
                      if (option === "annual") removePromo();
                    }}
                    className={cn(
                      "rounded-lg px-2 py-2.5 text-[13px] font-bold transition-colors",
                      billing === option
                        ? "bg-card text-navy shadow-sm"
                        : "text-muted-foreground",
                    )}
                  >
                    {option === "monthly" ? t.pay_monthly : t.pay_annual}
                    <span className="block text-[11.5px] font-semibold text-muted-foreground">
                      {option === "monthly"
                        ? `${formatAmount(plan.price_fcfa)} / ${t.per_month}`
                        : t.pay_annual_gift}
                    </span>
                  </button>
                ))}
              </div>
            ) : null}

            {annual && plan.price_fcfa > 0 ? (
              <p className="mb-4 text-[13px] text-muted-foreground">
                {t.pay_annual_note
                  .replace("{total}", formatAmount(annualPrice(plan.price_fcfa)))
                  .replace("{monthly}", formatAmount(Math.round(annualPrice(plan.price_fcfa) / 12)))}
              </p>
            ) : null}

            {plan.price_fcfa > 0 && !annual ? (
              <div className="mb-4">
                {promo ? (
                  <div className="flex items-center justify-between rounded-field border border-success/30 bg-success-surface px-4 py-3">
                    <div className="flex items-center gap-2 text-[13.5px] font-semibold text-success-foreground">
                      <Tag size={15} />
                      {promo.code} — {t.promo_applied_prefix} (
                      {formatAmount(promo.preview.discount_fcfa ?? 0)})
                    </div>
                    <button
                      type="button"
                      onClick={removePromo}
                      aria-label={t.promo_remove}
                      className="text-success-foreground/70 hover:text-success-foreground"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <Input
                      value={promoInput}
                      onChange={(e) => setPromoInput(e.target.value.toUpperCase())}
                      placeholder={t.promo_placeholder}
                      aria-label={t.promo_label}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      disabled={!promoInput.trim() || checkingPromo}
                      onClick={() => void applyPromo()}
                    >
                      {checkingPromo ? t.promo_checking : t.promo_apply}
                    </Button>
                  </div>
                )}
              </div>
            ) : null}

            <PaymentForm
              amount={amount}
              purpose="subscription"
              onPay={async ({ method, phone, transactionRef }) => {
                const response = await fetch("/api/payments", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    purpose: "subscription",
                    planKey: plan.key,
                    method,
                    phone,
                    transactionRef,
                    billing,
                    promoCode: annual ? undefined : promo?.code,
                  }),
                });
                if (!response.ok) {
                  // Le code d'échec porte tout ce que le payeur peut corriger
                  // (numéro, moyen, passerelle indisponible) : le jeter ici,
                  // c'est le condamner à réessayer à l'identique.
                  const failure = (await response
                    .json()
                    .catch(() => null)) as { error?: string } | null;
                  return { ok: false, error: failure?.error };
                }
                const data = await response.json();
                return {
                  ok: true,
                  status: data.status,
                  redirectUrl: data.redirectUrl ?? null,
                  reference: data.reference ?? null,
                };
              }}
              onSuccess={() => {
                toast.success(t.pay_welcome.replace("{plan}", plan.name), {
                  duration: 5000,
                });
                void queryClient.invalidateQueries();
                router.push("/accueil");
              }}
            />
          </>
        ) : plans ? (
          <p className="pt-8 text-center text-[14px] text-muted-foreground/70">
            {t.plan_not_found}
          </p>
        ) : null}
      </div>
    </div>
  );
}
