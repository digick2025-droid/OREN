import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient, settlePaymentIntent } from "@/services/payments";
import {
  parseEvent,
  verifyEventSignature,
} from "@/services/payments/kpay/signature";
import { normalizeStatus } from "@/services/payments/kpay/payload";

/**
 * Webhook K-PAY — confirmation d'un paiement Mobile Money.
 *
 * Route distincte de celle de CamerPay : les deux passerelles n'ont ni le même
 * format de corps (JSON vs form-urlencoded), ni le même schéma de signature,
 * ni le même secret. Les mélanger dans un seul handler ne ferait qu'ajouter
 * des branches sur un chemin où la moindre erreur coûte de l'argent.
 *
 * Contrat (doc « Webhooks » K-PAY) :
 *   - POST `application/json`, en-tête `X-KPAY-Signature` = HMAC-SHA256 hex
 *     du **corps brut**.
 *   - `externalId` est notre référence interne (OREN-SUB-… / OREN-EXP-…).
 *   - Statuts finaux : COMPLETED, FAILED, CANCELLED.
 *   - 3 tentatives (1 s, 2 s, 4 s), pas de rejeu sur 4xx.
 *
 * Le webhook n'est PAS l'unique chemin : `/api/payments/status` lit aussi
 * l'état chez K-PAY pendant que le client attend. Les deux passent par le même
 * `settle_payment_intent` verrouillé et idempotent — celui qui arrive en
 * premier règle, l'autre est sans effet.
 *
 * Sécurité : route publique (impossible d'authentifier K-PAY par session).
 * La signature est la SEULE barrière — sans secret configuré, on refuse tout,
 * jamais de mode dégradé.
 */

export async function POST(request: NextRequest) {
  const secret = process.env.KPAY_WEBHOOK_SECRET;
  if (!secret) {
    // Mal configuré ⇒ on ne peut rien authentifier. 500 (et non 401) pour que
    // l'échec pointe vers notre config et non vers K-PAY.
    return NextResponse.json(
      { error: "WEBHOOK_NOT_CONFIGURED" },
      { status: 500 },
    );
  }

  // Corps lu en TEXTE : la signature porte sur les octets reçus. Le parser en
  // JSON avant de vérifier ferait échouer toute comparaison.
  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });
  }

  if (
    !verifyEventSignature(rawBody, request.headers.get("x-kpay-signature"), secret)
  ) {
    return NextResponse.json({ error: "INVALID_SIGNATURE" }, { status: 401 });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });
  }

  const event = parseEvent(parsed);
  if (!event) {
    return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });
  }

  const status = normalizeStatus(event.status);
  const service = createServiceClient();

  // Contrôle du montant : K-PAY ne connaît pas nos tarifs. Sans cette
  // confrontation, un paiement de 100 FCFA validerait un abonnement à 3000.
  // `amount` est le montant demandé, avant commission — comparable tel quel.
  if (status === "succeeded" && event.amount !== undefined) {
    const { data: intent } = await service
      .from("payment_intents")
      .select("amount, status")
      .eq("reference", event.externalId)
      .maybeSingle();

    if (intent && intent.status === "pending") {
      if (event.amount !== Number(intent.amount)) {
        await settlePaymentIntent(
          {
            reference: event.externalId,
            providerReference: event.reference,
            status: "failed",
            failureReason: "Montant réglé différent du montant attendu",
            failureCode: "AMOUNT_MISMATCH",
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
        reference: event.externalId,
        providerReference: event.reference,
        status,
        failureReason: event.failureReason,
        failureCode:
          event.status.toUpperCase() === "CANCELLED" ? "CANCELLED" : undefined,
      },
      service,
    );
  } catch {
    // 5xx : K-PAY rejoue (3 tentatives). Le rejeu est sans danger, le
    // règlement étant idempotent.
    return NextResponse.json({ error: "SETTLEMENT_FAILED" }, { status: 500 });
  }

  if (settled === null) {
    // Référence inconnue : 404 plutôt que 500, pour ne pas faire rejouer un
    // événement qui ne nous concerne pas.
    return NextResponse.json({ error: "UNKNOWN_REFERENCE" }, { status: 404 });
  }

  return NextResponse.json({ received: true, status: settled });
}
