import { NextResponse, type NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceClient } from "@/services/payments";
import { clientIpFromHeaders, rateLimit } from "@/lib/rate-limit";

/**
 * Statut d'une intention de paiement, interrogé par `/paiement/retour` après
 * la redirection CamerPay (le client revient avant, ou pendant, que le
 * webhook signé ne règle l'intention).
 *
 * Public et sans session : un payeur express n'en a pas. `reference` contient
 * un UUID aléatoire (`OREN-EXP-…` / `OREN-SUB-…`) — c'est cette
 * inconnaissabilité qui sert de contrôle d'accès, jamais une preuve de
 * paiement en soi. Seul `settle_payment_intent` (appelé depuis le webhook
 * signé) fait autorité sur le statut.
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
    .select("status, purpose, plan_key")
    .eq("reference", reference)
    .maybeSingle();

  if (!intent) {
    return NextResponse.json({ error: "UNKNOWN_REFERENCE" }, { status: 404 });
  }

  return NextResponse.json({
    status: intent.status,
    purpose: intent.purpose,
    planKey: intent.plan_key,
  });
}
