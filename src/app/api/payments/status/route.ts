import { NextResponse, type NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  createServiceClient,
  getPaymentProvider,
  settlePaymentIntent,
} from "@/services/payments";
import { clientIpFromHeaders, rateLimit } from "@/lib/rate-limit";

/**
 * Statut d'une intention de paiement, interrogé par `/paiement/retour` après
 * la redirection CamerPay (le client revient avant, ou pendant, que le
 * webhook signé ne règle l'intention).
 *
 * Public et sans session : un payeur express n'en a pas. `reference` contient
 * un UUID aléatoire (`OREN-EXP-…` / `OREN-SUB-…`) — c'est cette
 * inconnaissabilité qui sert de contrôle d'accès, jamais une preuve de
 * paiement en soi.
 *
 * RÉCONCILIATION ACTIVE : tant que l'intention est en attente, on demande son
 * état réel à la passerelle (`checkStatus`) et on règle si elle a tranché.
 * Sans cela, un webhook qui n'arrive jamais — URL de callback mal déclarée,
 * notification perdue, endpoint indisponible pendant les ~17 s où CamerPay
 * réessaie — laisse l'intention en attente pour toujours, client débité.
 *
 * Le client ne décide toujours rien : il ne fait que déclencher une lecture
 * serveur→serveur authentifiée, et le règlement passe par le même
 * `settle_payment_intent` verrouillé que le webhook signé.
 */
export async function GET(request: NextRequest) {
  const ip = clientIpFromHeaders(request.headers);
  const limited = rateLimit(`pay:status:ip:${ip}`, {
    limit: 30,
    windowMs: 60_000,
  });
  if (!limited.ok) {
    return NextResponse.json(
      { error: "RATE_LIMITED" },
      {
        status: 429,
        headers: { "Retry-After": String(limited.retryAfterSeconds) },
      },
    );
  }

  const reference = request.nextUrl.searchParams.get("ref");
  if (!reference) {
    return NextResponse.json({ error: "MISSING_REFERENCE" }, { status: 400 });
  }

  let service: SupabaseClient;
  try {
    service = createServiceClient();
  } catch {
    return NextResponse.json(
      { error: "PAYMENTS_NOT_CONFIGURED" },
      { status: 500 },
    );
  }

  const { data: intent } = await service
    .from("payment_intents")
    .select(
      "status, purpose, plan_key, provider, provider_reference, amount, failure_reason",
    )
    .eq("reference", reference)
    .maybeSingle();

  if (!intent) {
    return NextResponse.json({ error: "UNKNOWN_REFERENCE" }, { status: 404 });
  }

  let status: string = intent.status;
  let failureReason: string | null = intent.failure_reason ?? null;

  if (status === "pending") {
    const reconciled = await reconcile(
      reference,
      intent as PendingIntent,
      service,
    );
    if (reconciled) {
      status = reconciled.status;
      failureReason = reconciled.failureReason;
    }
  }

  return NextResponse.json({
    status,
    purpose: intent.purpose,
    planKey: intent.plan_key,
    failureReason,
  });
}

interface PendingIntent {
  provider: string;
  provider_reference: string | null;
  amount: number | string;
  failure_reason: string | null;
}

/**
 * Demande à la passerelle où en est réellement la transaction, et règle
 * l'intention si elle a tranché.
 *
 * Ne renvoie quelque chose que si l'état a changé : toute incertitude
 * (fournisseur sans lecture de statut, réseau, réponse inattendue) laisse
 * l'intention en attente — jamais d'échec conclu par défaut.
 */
async function reconcile(
  reference: string,
  intent: PendingIntent,
  service: SupabaseClient,
): Promise<{ status: string; failureReason: string | null } | null> {
  if (!intent.provider_reference) return null;

  const provider = getPaymentProvider();
  // Le fournisseur courant n'est pas celui qui a créé l'intention (bascule de
  // PAYMENT_PROVIDER entre-temps) : sa référence ne lui parlerait pas.
  if (provider.name !== intent.provider || !provider.checkStatus) return null;

  const remote = await provider.checkStatus(intent.provider_reference);
  if (!remote || remote.status === "pending") return null;

  let status = remote.status;
  let failureReason = remote.failureReason ?? null;
  let failureCode = remote.failureCode ?? null;

  // Même garde-fou que le webhook : la passerelle ne connaît pas nos tarifs.
  // Un montant réglé différent de celui attendu ne vaut pas confirmation.
  if (status === "succeeded" && remote.amount !== undefined) {
    if (remote.amount !== Number(intent.amount)) {
      status = "failed";
      failureReason = "Montant réglé différent du montant attendu";
      failureCode = "AMOUNT_MISMATCH";
    }
  }

  try {
    const settled = await settlePaymentIntent(
      {
        reference,
        providerReference: intent.provider_reference,
        status,
        failureReason: failureReason ?? undefined,
        failureCode: failureCode ?? undefined,
      },
      service,
    );
    if (!settled) return null;
    return {
      status: settled,
      failureReason: settled === "failed" ? failureReason : null,
    };
  } catch {
    // Échec base : on ne ment pas au client, l'intention reste en attente.
    // Le webhook ou le prochain sondage repassera.
    return null;
  }
}
