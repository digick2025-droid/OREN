import type {
  PaymentInitiation,
  PaymentIntentInput,
  PaymentMethod,
  PaymentProvider,
} from "../types";
import { logInitiationRefusal } from "../log";

const WIDGET_URL = "https://api.monetbil.com/widget/v2.1";

/** Monetbil Widget API v2.1: hosted Mobile Money checkout. */
export class MonetbilProvider implements PaymentProvider {
  readonly name = "monetbil";

  private readonly serviceKey = process.env.MONETBIL_SERVICE_KEY ?? "";
  private readonly notifyUrl = process.env.MONETBIL_NOTIFY_URL ?? "";
  private readonly returnUrl = process.env.MONETBIL_RETURN_URL ?? "";

  async initiate(input: PaymentIntentInput): Promise<PaymentInitiation> {
    if (!this.serviceKey || !this.notifyUrl || !this.returnUrl) {
      return failed("PROVIDER_NOT_CONFIGURED");
    }

    const phone = input.phone ? toMonetbilPhone(input.phone) : "";
    if (!phone || phone.length !== 12) return failed("INVALID_PHONE");

    const operator = toMonetbilOperator(input.method);
    if (!operator) return failed("METHOD_NOT_SUPPORTED");

    const body = new URLSearchParams({
      amount: String(input.amount),
      phone,
      phone_lock: "true",
      locale: "fr",
      operator,
      country: "CM",
      currency: input.currency,
      item_ref: input.reference,
      payment_ref: input.reference,
      return_url: withReference(this.returnUrl, input.reference),
      notify_url: this.notifyUrl,
    });

    let response: Response;
    try {
      response = await fetch(`${WIDGET_URL}/${encodeURIComponent(this.serviceKey)}`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body,
        cache: "no-store",
      });
    } catch (cause) {
      logInitiationRefusal("monetbil", input.reference, "réseau", String(cause));
      return failed("PROVIDER_UNREACHABLE");
    }

    let data: unknown;
    try {
      data = await response.json();
    } catch {
      logInitiationRefusal("monetbil", input.reference, "réponse", "corps illisible");
      return failed(response.ok ? "PROVIDER_BAD_RESPONSE" : `PROVIDER_HTTP_${response.status}`);
    }

    const record = isRecord(data) ? data : null;
    const detail = record ? text(record.message) ?? text(record.error) : undefined;
    if (!response.ok || !record || record.success !== true) {
      const error = !response.ok
        ? `PROVIDER_HTTP_${response.status}`
        : detail ?? "PROVIDER_REFUSED";
      logInitiationRefusal("monetbil", input.reference, !response.ok ? `HTTP ${response.status}` : "refus applicatif", detail);
      return failed(detail && !error.includes(detail) ? `${error}: ${detail}` : error);
    }

    const redirectUrl = text(record.payment_url);
    if (!redirectUrl) {
      logInitiationRefusal("monetbil", input.reference, "réponse", "aucune payment_url");
      return failed("PROVIDER_NO_PAY_URL");
    }

    return {
      accepted: true,
      status: "pending",
      providerReference: input.reference,
      redirectUrl,
    };
  }
}

function failed(error: string): PaymentInitiation {
  return { accepted: false, status: "failed", providerReference: "", error };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function text(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function toMonetbilOperator(method: PaymentMethod): string | null {
  switch (method) {
    case "orange_money": return "CM_ORANGEMONEY";
    case "mtn_momo": return "CM_MTNMOBILEMONEY";
    default: return null;
  }
}

function toMonetbilPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (!digits) return "";
  const local = digits.startsWith("237") ? digits.slice(3) : digits.replace(/^0/, "");
  return `237${local}`;
}

function withReference(returnUrl: string, reference: string): string {
  try {
    const url = new URL(returnUrl);
    url.searchParams.set("ref", reference);
    return url.toString();
  } catch {
    return returnUrl;
  }
}
