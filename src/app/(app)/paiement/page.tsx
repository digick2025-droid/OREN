"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Tag, X } from "lucide-react";
import { ScreenHeader } from "@/components/screen-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PaymentForm } from "@/features/payments/payment-form";
import { useI18n } from "@/features/i18n/language-context";
import { usePlans } from "@/hooks/use-usage";
import { createClient } from "@/lib/supabase/client";
import { formatAmount } from "@/lib/format";

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
  searchParams: Promise<{ plan?: string }>;
}) {
  const { plan: planKey } = use(searchParams);
  const router = useRouter();
  const queryClient = useQueryClient();
  const { t } = useI18n();
  const { data: plans } = usePlans();
  const [promoInput, setPromoInput] = useState("");
  const [checkingPromo, setCheckingPromo] = useState(false);
  const [promo, setPromo] = useState<{ code: string; preview: PromoPreview } | null>(
    null,
  );

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

  const amount = promo?.preview.final_amount_fcfa ?? plan?.price_fcfa ?? 0;

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

            {plan.price_fcfa > 0 ? (
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
              onPay={async ({ method, phone }) => {
                const response = await fetch("/api/payments", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    purpose: "subscription",
                    planKey: plan.key,
                    method,
                    phone,
                    promoCode: promo?.code,
                  }),
                });
                if (!response.ok) return { ok: false };
                const data = await response.json();
                return {
                  ok: true,
                  status: data.status,
                  redirectUrl: data.redirectUrl ?? null,
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
