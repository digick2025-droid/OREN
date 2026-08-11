"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Clock, CreditCard, Loader2, ShieldCheck, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/features/i18n/language-context";
import { paymentErrorMessage } from "@/features/payments/errors";
import { formatAmount } from "@/lib/format";
import { isValidPhone } from "@/lib/phone";
import type { PaymentMethod } from "@/types/database";
import { cn } from "@/lib/utils";

export interface PaymentFormProps {
  amount: number;
  buttonLabel?: string;
  onPay: (input: { method: PaymentMethod; phone: string }) => Promise<{
    ok: boolean;
    /** "pending" = passerelle réelle, confirmation différée. */
    status?: "succeeded" | "pending";
    /**
     * URL de paiement hébergé. Présente pour une passerelle par redirection
     * (CamerPay), absente pour une passerelle qui pousse la demande sur le
     * téléphone (K-PAY) : dans ce cas le client reste ici et on attend.
     */
    redirectUrl?: string | null;
    /** Référence de l'intention, pour suivre le paiement sans quitter la page. */
    reference?: string | null;
    /** Code d'échec renvoyé par l'API (`INVALID_PHONE`, `PROVIDER_HTTP_401`…). */
    error?: string;
  }>;
  onSuccess: () => void;
}

/** Rythme d'attente sur place : ~60 s, le temps qu'un client saisisse son code. */
const POLL_INTERVAL_MS = 3000;
const MAX_ATTEMPTS = 20;

type Phase =
  | { kind: "form" }
  | { kind: "submitting" }
  /** Demande poussée sur le téléphone : on interroge notre API en attendant. */
  | { kind: "awaiting"; reference: string }
  | { kind: "timeout" };

export function PaymentForm({
  amount,
  buttonLabel,
  onPay,
  onSuccess,
}: PaymentFormProps) {
  const { t } = useI18n();
  const [method, setMethod] = useState<PaymentMethod>("orange_money");
  const [phone, setPhone] = useState("");
  const [phase, setPhase] = useState<Phase>({ kind: "form" });

  const methods: Array<{
    key: PaymentMethod;
    label: string;
    available: boolean;
  }> = [
    { key: "orange_money", label: "Orange Money", available: true },
    { key: "mtn_momo", label: "MTN MoMo", available: true },
    { key: "card", label: t.pay_card, available: false },
  ];

  // Gardée dans une ref : la boucle d'attente ne doit pas redémarrer parce
  // que le parent a re-rendu et changé l'identité de la fonction.
  const onSuccessRef = useRef(onSuccess);
  onSuccessRef.current = onSuccess;

  const pay = async () => {
    if (method !== "card" && !isValidPhone(phone)) {
      toast.error(t.pay_need_phone);
      return;
    }
    setPhase({ kind: "submitting" });
    const result = await onPay({ method, phone });
    if (!result.ok) {
      setPhase({ kind: "form" });
      toast.error(paymentErrorMessage(result.error, t));
      return;
    }
    if (result.status === "pending") {
      if (result.redirectUrl) {
        // Passerelle par redirection : le client quitte l'appli pour payer.
        // Le retour est géré par /paiement/retour — on laisse l'attente
        // affichée, la page est de toute façon sur le point de se décharger.
        window.location.assign(result.redirectUrl);
        return;
      }
      if (result.reference) {
        // La demande est partie sur le téléphone du client : il valide avec
        // son code secret sans jamais quitter l'application.
        setPhase({ kind: "awaiting", reference: result.reference });
        return;
      }
      // En attente sans rien pour suivre : on ne peut ni confirmer ni
      // laisser croire que c'est réglé.
      setPhase({ kind: "form" });
      toast.error(t.pay_failed);
      return;
    }
    setPhase({ kind: "form" });
    onSuccess();
  };

  // Attente sur place : on interroge notre API, qui lit elle-même l'état chez
  // la passerelle. Le webhook peut trancher avant, pendant ou après — c'est
  // sans importance, le règlement est idempotent.
  useEffect(() => {
    if (phase.kind !== "awaiting") return;
    const { reference } = phase;
    let cancelled = false;
    let attempts = 0;
    let timer: ReturnType<typeof setTimeout>;

    const poll = async () => {
      attempts += 1;
      try {
        const res = await fetch(
          `/api/payments/status?ref=${encodeURIComponent(reference)}`,
          { cache: "no-store" },
        );
        if (res.ok) {
          const data = (await res.json()) as {
            status: "pending" | "succeeded" | "failed";
            failureReason?: string | null;
          };
          if (cancelled) return;
          if (data.status === "succeeded") {
            onSuccessRef.current();
            return;
          }
          if (data.status === "failed") {
            // Le motif vient de l'opérateur (« Solde insuffisant », « PIN
            // incorrect ») : c'est lui qui dit au client quoi refaire.
            toast.error(data.failureReason || t.pay_failed);
            setPhase({ kind: "form" });
            return;
          }
        }
      } catch {
        // Raté réseau ponctuel : on réessaie au prochain tick sans alarmer.
      }
      if (cancelled) return;
      if (attempts >= MAX_ATTEMPTS) {
        setPhase({ kind: "timeout" });
        return;
      }
      timer = setTimeout(() => void poll(), POLL_INTERVAL_MS);
    };

    timer = setTimeout(() => void poll(), POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [phase, t.pay_failed]);

  const amountCard = (
    <Card className="p-4 text-center">
      <div className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground/70">
        {t.pay_amount}
      </div>
      <div className="mt-1 text-[26px] font-extrabold text-navy">
        {formatAmount(amount)}
      </div>
    </Card>
  );

  const secureNote = (
    <p className="flex items-center justify-center gap-1.5 text-center text-[11.5px] text-muted-foreground/70">
      <ShieldCheck size={13} />
      {t.pay_secure}
    </p>
  );

  // La demande est partie sur le téléphone : on masque le formulaire plutôt
  // que de laisser modifier un numéro sur lequel une demande court déjà.
  if (phase.kind === "awaiting") {
    return (
      <div className="space-y-4">
        {amountCard}
        <Card className="space-y-2 p-5 text-center">
          <Smartphone size={34} className="mx-auto text-navy" />
          <div className="text-[15px] font-bold text-navy">
            {t.pay_push_title}
          </div>
          <p className="text-[13px] text-muted-foreground">{t.pay_push_sub}</p>
          <Loader2 size={19} className="mx-auto animate-spin text-navy" />
        </Card>
        {secureNote}
      </div>
    );
  }

  if (phase.kind === "timeout") {
    return (
      <div className="space-y-4">
        {amountCard}
        <Card className="space-y-2 p-5 text-center">
          <Clock size={34} className="mx-auto text-warning" />
          <div className="text-[15px] font-bold text-navy">
            {t.pay_push_timeout_title}
          </div>
          <p className="text-[13px] text-muted-foreground">
            {t.pay_push_timeout_sub}
          </p>
        </Card>
        <Button
          size="lg"
          className="w-full"
          onClick={() => setPhase({ kind: "form" })}
        >
          {t.pay_retry}
        </Button>
        {secureNote}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {amountCard}

      <div>
        <Label>{t.pay_method}</Label>
        <div className="space-y-2">
          {methods.map((m) => (
            <button
              key={m.key}
              type="button"
              disabled={!m.available}
              onClick={() => setMethod(m.key)}
              className={cn(
                "flex w-full items-center gap-3 rounded-xl border-[1.5px] px-4 py-3.5 text-[14px] font-semibold transition-colors",
                method === m.key
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-muted-foreground",
                !m.available && "opacity-50",
              )}
            >
              {m.key === "card" ? (
                <CreditCard size={18} />
              ) : (
                <Smartphone size={18} />
              )}
              {m.label}
              {!m.available && (
                <span className="ml-auto rounded-full bg-warning-surface px-2 py-0.5 text-[10.5px] font-bold text-warning">
                  {t.pay_soon}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {method !== "card" && (
        <div>
          <Label htmlFor="pay-phone">{t.pay_phone}</Label>
          <Input
            id="pay-phone"
            inputMode="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="6 90 00 00 00"
          />
        </div>
      )}

      {phase.kind === "submitting" ? (
        <Card className="flex items-center gap-3 p-4">
          <Loader2 size={19} className="animate-spin text-navy" />
          <div>
            <div className="text-[14px] font-bold text-navy">
              {t.pay_processing}
            </div>
            <div className="text-[12px] text-muted-foreground/70">{t.pay_wait}</div>
          </div>
        </Card>
      ) : (
        <Button
          variant="accent"
          size="lg"
          className="w-full"
          onClick={() => void pay()}
        >
          {buttonLabel ?? t.pay_confirm}
        </Button>
      )}

      {secureNote}
    </div>
  );
}
