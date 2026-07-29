"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, Clock, Loader2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useI18n } from "@/features/i18n/language-context";

/**
 * Page de retour après une redirection CamerPay (`merchant_return_url`) —
 * l'aller-retour est : le client quitte l'appli pour payer sur camerpay.biz,
 * puis revient ici. Cette page NE RÈGLE RIEN elle-même : elle interroge
 * `/api/payments/status` (par polling, le webhook signé pouvant arriver
 * avant, pendant ou après ce retour) et se contente d'orienter le client une
 * fois l'intention tranchée.
 *
 * Route volontairement HORS du groupe `(app)` (qui exige une session +
 * entreprise) : un payeur de document express est anonyme.
 */

type Purpose = "subscription" | "express_document";

type PollState =
  | { kind: "invalid" }
  | { kind: "checking" }
  | { kind: "succeeded"; purpose: Purpose }
  | { kind: "failed"; reason: string | null }
  | { kind: "timeout" };

// Chaque sondage déclenche, côté serveur, une lecture de l'état réel chez la
// passerelle : on espace donc un peu plus qu'un simple polling en base.
const POLL_INTERVAL_MS = 3000;
const MAX_ATTEMPTS = 20; // ~60s, le temps qu'un paiement Mobile Money aboutisse

function RetourContent() {
  const { t } = useI18n();
  const router = useRouter();
  const searchParams = useSearchParams();
  const reference = searchParams.get("ref");

  const [state, setState] = useState<PollState>(
    reference ? { kind: "checking" } : { kind: "invalid" },
  );
  // Connu dès la 1ère réponse (même "pending") : sert à orienter le client
  // même en cas d'échec ou d'expiration du polling.
  const meta = useRef<{ purpose: Purpose | null; planKey: string | null }>({
    purpose: null,
    planKey: null,
  });

  useEffect(() => {
    if (!reference) return;
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
            purpose: Purpose;
            planKey: string | null;
            failureReason?: string | null;
          };
          meta.current = { purpose: data.purpose, planKey: data.planKey };
          if (data.status === "succeeded") {
            if (!cancelled) setState({ kind: "succeeded", purpose: data.purpose });
            return;
          }
          if (data.status === "failed") {
            if (!cancelled) {
              setState({ kind: "failed", reason: data.failureReason ?? null });
            }
            return;
          }
        }
      } catch {
        // Raté réseau ponctuel : on réessaie au prochain tick sans alarmer.
      }
      if (cancelled) return;
      if (attempts >= MAX_ATTEMPTS) {
        setState({ kind: "timeout" });
        return;
      }
      timer = setTimeout(() => void poll(), POLL_INTERVAL_MS);
    };

    void poll();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [reference]);

  // Paiement acquis : on continue le parcours (abonnement → accueil,
  // document express → retour sur /express pour reconstruire le document).
  const goToSuccess = (purpose: Purpose) => {
    if (purpose === "express_document" && reference) {
      router.push(`/express?paid=${encodeURIComponent(reference)}`);
    } else {
      router.push("/accueil");
    }
  };

  // Échec ou expiration : on renvoie vers le point de départ pour réessayer,
  // jamais vers une page qui suppose le paiement acquis.
  const goToRetry = () => {
    const { purpose, planKey } = meta.current;
    if (purpose === "express_document") {
      router.push("/express");
    } else if (purpose === "subscription") {
      router.push(planKey ? `/paiement?plan=${encodeURIComponent(planKey)}` : "/offres");
    } else {
      router.push("/");
    }
  };

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md items-center justify-center px-4">
      <Card className="w-full space-y-4 p-6 text-center">
        {state.kind === "invalid" && (
          <>
            <XCircle size={40} className="mx-auto text-muted-foreground/60" />
            <h1 className="text-[17px] font-bold text-navy">
              {t.retour_invalid_title}
            </h1>
            <p className="text-[13.5px] text-muted-foreground">
              {t.retour_invalid_sub}
            </p>
            <Button className="w-full" onClick={() => router.push("/")}>
              {t.retour_back}
            </Button>
          </>
        )}

        {state.kind === "checking" && (
          <>
            <Loader2 size={40} className="mx-auto animate-spin text-navy" />
            <h1 className="text-[17px] font-bold text-navy">
              {t.retour_checking_title}
            </h1>
            <p className="text-[13.5px] text-muted-foreground">
              {t.retour_checking_sub}
            </p>
          </>
        )}

        {state.kind === "succeeded" && (
          <>
            <CheckCircle2 size={40} className="mx-auto text-success" />
            <h1 className="text-[17px] font-bold text-navy">
              {t.retour_succeeded_title}
            </h1>
            <p className="text-[13.5px] text-muted-foreground">
              {state.purpose === "subscription"
                ? t.retour_succeeded_sub_sub
                : t.retour_succeeded_sub_express}
            </p>
            <Button
              variant="accent"
              className="w-full"
              onClick={() => goToSuccess(state.purpose)}
            >
              {t.retour_continue}
            </Button>
          </>
        )}

        {state.kind === "failed" && (
          <>
            <XCircle size={40} className="mx-auto text-danger" />
            <h1 className="text-[17px] font-bold text-navy">
              {t.retour_failed_title}
            </h1>
            <p className="text-[13.5px] text-muted-foreground">
              {t.retour_failed_sub}
            </p>
            {state.reason && (
              // Motif renvoyé par l'opérateur (« Solde insuffisant », « PIN
              // incorrect »…) : c'est ce qui dit au client quoi refaire.
              <p className="rounded-xl bg-error-surface px-3 py-2 text-[12.5px] font-semibold text-danger">
                {state.reason}
              </p>
            )}
            <Button className="w-full" onClick={goToRetry}>
              {t.retour_retry}
            </Button>
          </>
        )}

        {state.kind === "timeout" && (
          <>
            <Clock size={40} className="mx-auto text-warning" />
            <h1 className="text-[17px] font-bold text-navy">
              {t.retour_timeout_title}
            </h1>
            <p className="text-[13.5px] text-muted-foreground">
              {t.retour_timeout_sub}
            </p>
            <Button className="w-full" onClick={goToRetry}>
              {t.retour_back}
            </Button>
          </>
        )}
      </Card>
    </div>
  );
}

export default function PaiementRetourPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh items-center justify-center">
          <Loader2 size={32} className="animate-spin text-navy" />
        </div>
      }
    >
      <RetourContent />
    </Suspense>
  );
}
