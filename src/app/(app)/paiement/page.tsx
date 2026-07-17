"use client";

import { use } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ScreenHeader } from "@/components/screen-header";
import { PaymentForm } from "@/features/payments/payment-form";
import { useI18n } from "@/features/i18n/language-context";
import { usePlans } from "@/hooks/use-usage";

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

  const plan = (plans ?? []).find((p) => p.key === planKey);

  return (
    <div>
      <ScreenHeader title={t.pay_title} backHref="/offres" />
      <div className="px-4 pt-4">
        {plan ? (
          <>
            <p className="pb-4 text-[14px] text-[#5A6377]">
              {t.pay_sub_prefix}{" "}
              <span className="font-bold text-navy">{plan.name}</span>
            </p>
            <PaymentForm
              amount={plan.price_fcfa}
              onPay={async ({ method, phone }) => {
                const response = await fetch("/api/payments", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    purpose: "subscription",
                    planKey: plan.key,
                    method,
                    phone,
                  }),
                });
                return { ok: response.ok };
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
          <p className="pt-8 text-center text-[14px] text-[#8A93A6]">
            {t.plan_not_found}
          </p>
        ) : null}
      </div>
    </div>
  );
}
