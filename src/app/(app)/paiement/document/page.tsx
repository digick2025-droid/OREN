"use client";

import { useState } from "react";
import Link from "next/link";
import { redirect, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Gift, Minus, Plus } from "lucide-react";
import { ScreenHeader } from "@/components/screen-header";
import { Card } from "@/components/ui/card";
import { PaymentForm } from "@/features/payments/payment-form";
import { useI18n } from "@/features/i18n/language-context";
import { usePlans, useUsage } from "@/hooks/use-usage";
import { FREE_LAUNCH } from "@/lib/billing";
import { formatAmount } from "@/lib/format";
import { breakEvenDocuments, pricePerDocument } from "@/lib/pricing";

const MAX_QUANTITY = 10;
/** Repli si le plan « express » n'a pas de prix en base (même défaut que l'API). */
const DEFAULT_UNIT_PRICE = 500;

/**
 * Achat de documents à l'unité, une fois le quota de l'offre atteint.
 * Le montant affiché n'est qu'un aperçu : l'API recalcule le prix depuis la
 * base et ne fait jamais confiance au client.
 */
export default function PaiementDocumentPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { t } = useI18n();
  const { data: plans } = usePlans();
  const { data: usage } = useUsage();
  const [quantity, setQuantity] = useState(1);

  if (FREE_LAUNCH) redirect("/offres");

  const unitPrice =
    plans?.find((p) => p.key === "express")?.per_document_price_fcfa ||
    DEFAULT_UNIT_PRICE;
  const proPlan = plans?.find((p) => p.key === "pro" && p.price_fcfa > 0);
  const proPerDoc = proPlan
    ? pricePerDocument(proPlan.price_fcfa, proPlan.monthly_quota)
    : null;

  return (
    <div>
      <ScreenHeader title={t.buydoc_title} backHref="/accueil" />
      <div className="space-y-4 px-4 pt-4">
        <p className="text-[14px] text-muted-foreground">{t.buydoc_sub}</p>

        <Card className="flex items-center justify-between p-4">
          <div>
            <div className="text-[13px] font-semibold text-muted-foreground">
              {t.buydoc_qty}
            </div>
            <div className="text-[12px] text-muted-foreground/70">
              {formatAmount(unitPrice)} / {t.buydoc_unit}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              aria-label="-"
              disabled={quantity <= 1}
              onClick={() => setQuantity((q) => Math.max(q - 1, 1))}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-navy disabled:opacity-40"
            >
              <Minus size={16} />
            </button>
            <span className="w-6 text-center text-[18px] font-extrabold text-navy">
              {quantity}
            </span>
            <button
              type="button"
              aria-label="+"
              disabled={quantity >= MAX_QUANTITY}
              onClick={() => setQuantity((q) => Math.min(q + 1, MAX_QUANTITY))}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-navy disabled:opacity-40"
            >
              <Plus size={16} />
            </button>
          </div>
        </Card>

        {/* Comparaison qui rend le forfait évident, sans rien bloquer : le
            document à l'unité reste le chemin le plus court. */}
        {proPlan && proPerDoc !== null ? (
          <Link
            href="/paiement?plan=pro"
            className="block rounded-xl border border-dashed border-border px-4 py-3 text-[13px] text-muted-foreground hover:border-navy"
          >
            {t.buydoc_pro_hint
              .replace("{n}", String(breakEvenDocuments(proPlan.price_fcfa, unitPrice)))
              .replace("{quota}", String(proPlan.monthly_quota))
              .replace("{price}", formatAmount(proPlan.price_fcfa))
              .replace("{per}", formatAmount(proPerDoc))}{" "}
            <span className="font-semibold text-navy underline">{t.buydoc_pro_cta}</span>
          </Link>
        ) : null}

        {usage && usage.credits > 0 ? (
          <p className="text-[12.5px] text-muted-foreground/70">
            {t.buydoc_balance.replace("{n}", String(usage.credits))}
          </p>
        ) : null}

        <PaymentForm
          amount={unitPrice * quantity}
          purpose="document_credit"
          onPay={async ({ method, phone, transactionRef }) => {
            const response = await fetch("/api/payments", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                purpose: "document_credit",
                quantity,
                method,
                phone,
                transactionRef,
              }),
            });
            if (!response.ok) {
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
            toast.success(t.buydoc_success, { duration: 5000 });
            void queryClient.invalidateQueries();
            router.push("/nouveau?type=devis");
          }}
        />

        <Link
          href="/parrainage"
          className="flex items-center gap-3 rounded-2xl border border-coral/40 bg-accent/10 px-4 py-3.5"
        >
          <Gift size={20} className="shrink-0 text-coral" />
          <div className="text-[13px] text-navy">
            <span className="font-bold">{t.buydoc_free_title}</span>{" "}
            {t.buydoc_free_sub}
          </div>
        </Link>
      </div>
    </div>
  );
}
