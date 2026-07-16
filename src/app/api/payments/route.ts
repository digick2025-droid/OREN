import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getPaymentProvider } from "@/services/payments";
import type { PaymentMethod } from "@/types/database";

interface PaymentBody {
  purpose: "subscription" | "express_document";
  method: PaymentMethod;
  phone?: string;
  planKey?: string;
}

function isPaymentBody(value: unknown): value is PaymentBody {
  if (typeof value !== "object" || value === null) return false;
  const body = value as Record<string, unknown>;
  return (
    (body.purpose === "subscription" || body.purpose === "express_document") &&
    (body.method === "orange_money" ||
      body.method === "mtn_momo" ||
      body.method === "card")
  );
}

export async function POST(request: NextRequest) {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });
  }
  if (!isPaymentBody(raw)) {
    return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });
  }
  const body = raw;

  const supabase = await createClient();
  const provider = getPaymentProvider();

  // ---- Express : 500 FCFA par document, sans compte ----
  if (body.purpose === "express_document") {
    const { data: plan } = await supabase
      .from("plans")
      .select("per_document_price_fcfa")
      .eq("key", "express")
      .single();
    const amount = plan?.per_document_price_fcfa ?? 500;

    const result = await provider.charge({
      amount,
      method: body.method,
      phone: body.phone,
      purpose: "express_document",
    });
    if (!result.success) {
      return NextResponse.json(
        { error: result.error ?? "PAYMENT_FAILED" },
        { status: 402 },
      );
    }
    return NextResponse.json({ reference: result.reference, amount });
  }

  // ---- Abonnement : utilisateur connecté uniquement ----
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  if (!body.planKey) {
    return NextResponse.json({ error: "MISSING_PLAN" }, { status: 400 });
  }

  const [{ data: company }, { data: plan }] = await Promise.all([
    supabase
      .from("companies")
      .select("id")
      .eq("owner_id", user.id)
      .is("deleted_at", null)
      .maybeSingle(),
    supabase
      .from("plans")
      .select("key, price_fcfa, is_active")
      .eq("key", body.planKey)
      .maybeSingle(),
  ]);
  if (!company) {
    return NextResponse.json({ error: "NO_COMPANY" }, { status: 400 });
  }
  if (!plan || !plan.is_active) {
    return NextResponse.json({ error: "INVALID_PLAN" }, { status: 400 });
  }

  if (plan.price_fcfa > 0) {
    const result = await provider.charge({
      amount: plan.price_fcfa,
      method: body.method,
      phone: body.phone,
      purpose: "subscription",
      planKey: plan.key,
    });
    if (!result.success) {
      return NextResponse.json(
        { error: result.error ?? "PAYMENT_FAILED" },
        { status: 402 },
      );
    }
    await supabase.from("payments").insert({
      company_id: company.id,
      amount: plan.price_fcfa,
      provider: provider.name,
      method: body.method,
      status: "succeeded",
      reference: result.reference,
      phone: body.phone ?? null,
    });
  }

  const { error: planError } = await supabase.rpc("change_plan", {
    p_company_id: company.id,
    p_plan_key: plan.key,
  });
  if (planError) {
    return NextResponse.json({ error: "PLAN_CHANGE_FAILED" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
