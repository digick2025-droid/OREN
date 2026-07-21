import { NextResponse, type NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import {
  createServiceClient,
  getPaymentProvider,
  settlePaymentIntent,
} from "@/services/payments";
import { clientIpFromHeaders, rateLimit } from "@/lib/rate-limit";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { PaymentInitiation } from "@/services/payments";
import type { PaymentMethod } from "@/types/database";

interface PaymentBody {
  purpose: "subscription" | "express_document";
  method: PaymentMethod;
  phone?: string;
  planKey?: string;
  /** Code promo (abonnement uniquement) — revalidé authoritativement ici. */
  promoCode?: string;
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

/**
 * Traduit un échec d'initiation en réponse HTTP. `accepted === false` ⇒ la
 * passerelle a refusé (mauvais numéro, montant, indisponible…) → 402.
 */
function initiationError(result: PaymentInitiation): NextResponse {
  return NextResponse.json(
    { error: result.error ?? "PAYMENT_FAILED" },
    { status: 402 },
  );
}

export async function POST(request: NextRequest) {
  // Rate-limit best-effort par IP : un endpoint de paiement est une cible
  // d'abus (spam d'initiations, énumération). Fenêtre courte et stricte.
  const ip = clientIpFromHeaders(request.headers);
  const limited = rateLimit(`pay:ip:${ip}`, { limit: 10, windowMs: 60_000 });
  if (!limited.ok) {
    return NextResponse.json(
      { error: "RATE_LIMITED" },
      {
        status: 429,
        headers: { "Retry-After": String(limited.retryAfterSeconds) },
      },
    );
  }

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

  // Les intentions de paiement sont écrites avec le service role : elles ne
  // doivent jamais être créées ni modifiées depuis le navigateur (un payeur
  // express est d'ailleurs anonyme et n'a aucune session).
  let service: SupabaseClient;
  try {
    service = createServiceClient();
  } catch {
    return NextResponse.json(
      { error: "PAYMENTS_NOT_CONFIGURED" },
      { status: 500 },
    );
  }

  // ---- Express : 500 FCFA par document, sans compte ----
  if (body.purpose === "express_document") {
    const { data: plan } = await supabase
      .from("plans")
      .select("per_document_price_fcfa, is_active")
      .eq("key", "express")
      .maybeSingle();
    if (!plan || !plan.is_active) {
      return NextResponse.json({ error: "INVALID_PLAN" }, { status: 400 });
    }
    const amount = plan.per_document_price_fcfa ?? 500;

    const reference = `OREN-EXP-${randomUUID()}`;
    // L'intention est persistée AVANT l'appel passerelle : si le webhook
    // arrive avant que `initiate()` ne rende la main, la référence existe déjà.
    const { error: intentError } = await service
      .from("payment_intents")
      .insert({
        reference,
        provider: provider.name,
        purpose: "express_document",
        amount,
        currency: "XAF",
        method: body.method,
        phone: body.phone ?? null,
      });
    if (intentError) {
      return NextResponse.json({ error: "INTENT_FAILED" }, { status: 500 });
    }

    const result = await provider.initiate({
      reference,
      amount,
      currency: "XAF",
      method: body.method,
      phone: body.phone,
      purpose: "express_document",
    });
    if (!result.accepted || result.status === "failed") {
      await settlePaymentIntent(
        { reference, providerReference: result.providerReference, status: "failed" },
        service,
      );
      return initiationError(result);
    }

    // Passerelle réelle : la confirmation viendra du webhook signé. On renvoie
    // la référence (et l'éventuelle URL de paiement hébergé) pour le suivi.
    if (result.status === "pending") {
      await service
        .from("payment_intents")
        .update({ provider_reference: result.providerReference })
        .eq("reference", reference);
      return NextResponse.json({
        status: "pending",
        reference,
        redirectUrl: result.redirectUrl ?? null,
        amount,
      });
    }

    // Réglé de façon synchrone (simulateur) : on passe par le MÊME chemin de
    // confirmation que le webhook, pour ne pas avoir deux vérités.
    await settlePaymentIntent(
      { reference, providerReference: result.providerReference, status: "succeeded" },
      service,
    );
    return NextResponse.json({
      status: "succeeded",
      reference: result.providerReference || reference,
      amount,
    });
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
    // Code promo optionnel : revalidé ici (authoritatif), jamais le montant
    // envoyé tel quel par le client — même RPC que l'aperçu côté formulaire.
    let amount = plan.price_fcfa;
    let promoCodeId: string | null = null;
    let discountFcfa = 0;
    if (body.promoCode) {
      const { data: promoResult, error: promoError } = await supabase.rpc(
        "preview_promo_code",
        { p_code: body.promoCode, p_plan_key: plan.key },
      );
      if (promoError) {
        return NextResponse.json(
          { error: "PROMO_CHECK_FAILED" },
          { status: 500 },
        );
      }
      const preview = promoResult as {
        valid: boolean;
        reason: string | null;
        promo_code_id: string | null;
        discount_fcfa: number | null;
        final_amount_fcfa: number | null;
      };
      if (!preview.valid) {
        return NextResponse.json(
          { error: "INVALID_PROMO", reason: preview.reason },
          { status: 400 },
        );
      }
      amount = preview.final_amount_fcfa ?? amount;
      promoCodeId = preview.promo_code_id;
      discountFcfa = preview.discount_fcfa ?? 0;
    }

    const reference = `OREN-SUB-${randomUUID()}`;
    const { error: intentError } = await service
      .from("payment_intents")
      .insert({
        reference,
        provider: provider.name,
        purpose: "subscription",
        company_id: company.id,
        plan_key: plan.key,
        amount,
        currency: "XAF",
        method: body.method,
        phone: body.phone ?? null,
        promo_code_id: promoCodeId,
        discount_fcfa: discountFcfa,
      });
    if (intentError) {
      return NextResponse.json({ error: "INTENT_FAILED" }, { status: 500 });
    }

    const result = await provider.initiate({
      reference,
      amount,
      currency: "XAF",
      method: body.method,
      phone: body.phone,
      purpose: "subscription",
      planKey: plan.key,
    });
    if (!result.accepted || result.status === "failed") {
      await settlePaymentIntent(
        { reference, providerReference: result.providerReference, status: "failed" },
        service,
      );
      return initiationError(result);
    }

    // Passerelle réelle : ne PAS changer d'offre ici. Le webhook signé
    // confirmera le paiement et appliquera le plan (source de vérité unique).
    if (result.status === "pending") {
      await service
        .from("payment_intents")
        .update({ provider_reference: result.providerReference })
        .eq("reference", reference);
      return NextResponse.json({
        status: "pending",
        reference,
        redirectUrl: result.redirectUrl ?? null,
      });
    }

    // Réglé de façon synchrone (simulateur) : `settle_payment_intent` insère
    // le paiement ET applique l'offre — rien à faire de plus ici.
    const settled = await settlePaymentIntent(
      { reference, providerReference: result.providerReference, status: "succeeded" },
      service,
    );
    if (settled !== "succeeded") {
      return NextResponse.json({ error: "PLAN_CHANGE_FAILED" }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  // ---- Offre gratuite : aucun paiement, changement direct ----
  const { error: planError } = await supabase.rpc("change_plan", {
    p_company_id: company.id,
    p_plan_key: plan.key,
  });
  if (planError) {
    return NextResponse.json({ error: "PLAN_CHANGE_FAILED" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
