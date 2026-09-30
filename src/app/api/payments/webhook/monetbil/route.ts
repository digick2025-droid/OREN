import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient, settlePaymentIntent } from "@/services/payments";

/**
 * Monetbil notifies this endpoint by GET or POST for successful and failed
 * payments. The notify URL contains a secret token: it is mandatory because
 * it remains secure on Vercel where a stable source-IP allow list is not.
 */
export async function GET(request: NextRequest) {
  return handle(request, Object.fromEntries(request.nextUrl.searchParams));
}

export async function POST(request: NextRequest) {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    try {
      const payload = await request.json();
      if (typeof payload === "object" && payload !== null) {
        return handle(request, stringFields(payload));
      }
    } catch {
      // Fall through to the regular invalid-body reply.
    }
    return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });
  }

  try {
    const form = await request.formData();
    return handle(request, Object.fromEntries(
      Array.from(form.entries(), ([key, value]) => [key, typeof value === "string" ? value : ""]),
    ));
  } catch {
    return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });
  }
}

async function handle(request: NextRequest, fields: Record<string, string>) {
  const token = process.env.MONETBIL_NOTIFY_TOKEN;
  if (!token) {
    return NextResponse.json({ error: "WEBHOOK_NOT_CONFIGURED" }, { status: 500 });
  }
  if (request.nextUrl.searchParams.get("token") !== token) {
    return NextResponse.json({ error: "INVALID_TOKEN" }, { status: 401 });
  }

  const serviceKey = process.env.MONETBIL_SERVICE_KEY;
  if (!serviceKey || fields.service !== serviceKey) {
    return NextResponse.json({ error: "INVALID_SERVICE" }, { status: 401 });
  }

  const reference = fields.payment_ref || fields.item_ref;
  const providerReference = fields.transaction_uuid || fields.transaction_id;
  const status = normalizeStatus(fields.status);
  const amount = Number(fields.amount);
  if (!reference || !providerReference || !status) {
    return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });
  }
  // Failed/cancelled notifications can omit the amount because no money was
  // collected. A successful notification must always carry it for the guard.
  if (status === "succeeded" && !Number.isFinite(amount)) {
    return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });
  }

  const service = createServiceClient();
  const { data: intent } = await service
    .from("payment_intents")
    .select("amount, provider")
    .eq("reference", reference)
    .maybeSingle();
  if (!intent || intent.provider !== "monetbil") {
    return NextResponse.json({ error: "UNKNOWN_REFERENCE" }, { status: 404 });
  }

  let settledStatus = status;
  let failureReason = fields.message || undefined;
  let failureCode = status === "failed" ? fields.status : undefined;
  if (status === "succeeded" && amount !== Number(intent.amount)) {
    settledStatus = "failed";
    failureReason = "Montant réglé différent du montant attendu";
    failureCode = "AMOUNT_MISMATCH";
  }

  try {
    const settled = await settlePaymentIntent({
      reference,
      providerReference,
      status: settledStatus,
      failureReason,
      failureCode,
    }, service);
    if (!settled) return NextResponse.json({ error: "UNKNOWN_REFERENCE" }, { status: 404 });
    return NextResponse.json({ ok: true, status: settled });
  } catch {
    return NextResponse.json({ error: "SETTLEMENT_FAILED" }, { status: 500 });
  }
}

/**
 * `fields` is indexed, and `noUncheckedIndexedAccess` makes every lookup
 * possibly undefined — a notification that simply omits `status` is a real
 * case, not a type-system formality. It falls through to `null`, which the
 * caller already turns into INVALID_BODY.
 */
function normalizeStatus(raw: string | undefined): "succeeded" | "failed" | null {
  switch (raw?.toLowerCase().trim()) {
    case "success": return "succeeded";
    case "failed":
    case "cancelled": return "failed";
    default: return null;
  }
}

function stringFields(value: object): Record<string, string> {
  return Object.fromEntries(
    Object.entries(value).map(([key, field]) => [
      key,
      typeof field === "string" || typeof field === "number" ? String(field) : "",
    ]),
  );
}
