import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient, settlePaymentIntent } from "@/services/payments";
import {
  parseCallback,
  verifyCallbackSignature,
} from "@/services/payments/camerpay/signature";
import { normalizeStatus } from "@/services/payments/camerpay/payload";

/**
 * Callback CamerPay — SOURCE DE VÉRITÉ du paiement.
 *
 * C'est ici, et nulle part ailleurs, qu'un paiement devient réellement
 * acquis : `settle_payment_intent` insère la ligne `payments` et applique
 * l'offre, de façon atomique et idempotente.
 *
 * Contrat CamerPay (doc « API REST » → Webhooks) :
 *   - POST JSON vers notre `merchant_callback_url`.
 *   - La signature est un champ `signature` DU CORPS, calculé sur
 *     `transaction_uuid|invoice_id|status|amount` (voir signature.ts).
 *   - `invoice_id` nous revient : c'est le `merchant_invoice_id` envoyé à
 *     l'initiation, donc notre référence interne (OREN-SUB-… / OREN-EXP-…).
 *   - Il faut répondre 200 pour accuser réception ; CamerPay réessaie
 *     jusqu'à 5 fois sinon.
 *
 * Sécurité : la route est publique (impossible d'authentifier CamerPay par
 * session). La signature est la SEULE barrière — sans secret configuré, on
 * refuse tout, jamais de mode dégradé.
 */

export async function POST(request: NextRequest) {
  const secret = process.env.CAMERPAY_WEBHOOK_SECRET;
  if (!secret) {
    // Mal configuré ⇒ on ne peut rien authentifier. 500 (et non 401) pour que
    // l'échec pointe vers notre config et non vers CamerPay.
    return NextResponse.json(
      { error: "WEBHOOK_NOT_CONFIGURED" },
      { status: 500 },
    );
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });
  }

  const callback = parseCallback(payload);
  if (!callback) {
    return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });
  }

  const signature = (payload as Record<string, unknown>).signature;
  if (
    !verifyCallbackSignature(
      callback,
      typeof signature === "string" ? signature : null,
      secret,
    )
  ) {
    return NextResponse.json({ error: "INVALID_SIGNATURE" }, { status: 401 });
  }

  const status = normalizeStatus(callback.status);
  const service = createServiceClient();

  // Le montant fait partie des champs signés : on peut donc le confronter à
  // l'intention. Sans ce contrôle, un paiement de 100 FCFA validerait un
  // abonnement à 3000 (CamerPay ne connaît pas nos tarifs).
  if (status === "succeeded") {
    const { data: intent } = await service
      .from("payment_intents")
      .select("amount, status")
      .eq("reference", callback.invoiceId)
      .maybeSingle();

    if (intent && intent.status === "pending") {
      // `amount` peut revenir en chaîne (bigint via PostgREST) : on compare
      // en nombre pour ne pas rejeter "3000" face à 3000.
      const expected = Number(intent.amount);
      const paid = Number(callback.amount);
      if (!Number.isFinite(paid) || paid !== expected) {
        await settlePaymentIntent(
          {
            reference: callback.invoiceId,
            providerReference: callback.transactionUuid,
            status: "failed",
          },
          service,
        );
        return NextResponse.json({ error: "AMOUNT_MISMATCH" }, { status: 400 });
      }
    }
  }

  let settled: "succeeded" | "failed" | "pending" | null;
  try {
    settled = await settlePaymentIntent(
      {
        reference: callback.invoiceId,
        providerReference: callback.transactionUuid,
        status,
      },
      service,
    );
  } catch {
    // Erreur base : 500 pour que CamerPay REJOUE (jusqu'à 5 fois).
    // Le rejeu est sans danger : `settle_payment_intent` est idempotent.
    return NextResponse.json({ error: "SETTLEMENT_FAILED" }, { status: 500 });
  }

  if (settled === null) {
    // Référence inconnue : ne pas répondre 500, sinon CamerPay rejouerait
    // 5 fois un événement qui ne nous concerne pas.
    return NextResponse.json({ error: "UNKNOWN_REFERENCE" }, { status: 404 });
  }

  return NextResponse.json({ received: true, status: settled });
}
