import type {
  PaymentProvider,
  PaymentIntentInput,
  PaymentInitiation,
} from "../types";

/**
 * Fournisseur CamerPay (Mobile Money Cameroun).
 *
 * ⚠️ Le contrat exact de l'API d'initiation CamerPay n'est pas figé ici :
 * tout est **paramétrable par variables d'environnement** et le parsing de
 * la réponse est **défensif** (plusieurs noms de champs tolérés). Aucune
 * clé n'est jamais codée en dur.
 *
 * Variables d'environnement attendues (côté serveur uniquement) :
 *   - CAMERPAY_API_URL      : endpoint d'initiation (POST JSON).
 *   - CAMERPAY_API_KEY      : clé/secret d'API, envoyée en `Authorization: Bearer`.
 *   - CAMERPAY_CALLBACK_URL : (optionnel) URL publique du webhook OREN
 *                             (`https://<app>/api/payments/webhook`) transmise
 *                             à CamerPay comme callback de confirmation.
 *
 * HYPOTHÈSES sur l'API (à ajuster selon la doc réelle CamerPay) :
 *   - POST JSON, réponse JSON.
 *   - Un identifiant de transaction est renvoyé sous l'un de :
 *     `reference`, `transaction_id`, `transactionId`, `id`, `data.reference`.
 *   - Un statut éventuel sous `status` ; toute valeur ≠ "success"/"succeeded"
 *     est traitée comme **pending** (la confirmation viendra du webhook signé).
 *   - Une URL de paiement hébergé peut être renvoyée sous `payment_url` /
 *     `redirect_url` / `checkout_url` (optionnelle pour le Mobile Money USSD).
 */
export class CamerPayProvider implements PaymentProvider {
  readonly name = "camerpay";

  private readonly apiUrl: string;
  private readonly apiKey: string;
  private readonly callbackUrl?: string;

  constructor() {
    this.apiUrl = process.env.CAMERPAY_API_URL ?? "";
    this.apiKey = process.env.CAMERPAY_API_KEY ?? "";
    this.callbackUrl = process.env.CAMERPAY_CALLBACK_URL || undefined;
  }

  async initiate(input: PaymentIntentInput): Promise<PaymentInitiation> {
    if (!this.apiUrl || !this.apiKey) {
      // Mauvaise configuration serveur : on échoue proprement plutôt que
      // d'appeler une URL vide.
      return {
        accepted: false,
        status: "failed",
        providerReference: "",
        error: "PROVIDER_NOT_CONFIGURED",
      };
    }
    if (
      (input.method === "orange_money" || input.method === "mtn_momo") &&
      !(input.phone && input.phone.replace(/[^\d]/g, "").length >= 8)
    ) {
      return {
        accepted: false,
        status: "failed",
        providerReference: "",
        error: "INVALID_PHONE",
      };
    }

    // Corps de requête défensif : on envoie les champs les plus courants.
    const payload: Record<string, unknown> = {
      amount: input.amount,
      currency: input.currency,
      reference: input.reference,
      method: input.method,
      channel: mapChannel(input.method),
      phone: input.phone ?? null,
      description: describe(input),
      metadata: input.metadata ?? {},
    };
    if (this.callbackUrl) {
      payload.callback_url = this.callbackUrl;
      payload.webhook_url = this.callbackUrl;
    }

    let response: Response;
    try {
      response = await fetch(this.apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(payload),
        // Ne jamais mettre en cache un appel de paiement.
        cache: "no-store",
      });
    } catch {
      return {
        accepted: false,
        status: "failed",
        providerReference: "",
        error: "PROVIDER_UNREACHABLE",
      };
    }

    if (!response.ok) {
      return {
        accepted: false,
        status: "failed",
        providerReference: "",
        error: `PROVIDER_HTTP_${response.status}`,
      };
    }

    let data: unknown;
    try {
      data = await response.json();
    } catch {
      // Réponse non-JSON mais 2xx : on considère l'initiation acceptée,
      // la confirmation viendra du webhook.
      return {
        accepted: true,
        status: "pending",
        providerReference: input.reference,
      };
    }

    const providerReference =
      pickString(data, [
        "reference",
        "transaction_id",
        "transactionId",
        "id",
      ]) ?? input.reference;

    const redirectUrl = pickString(data, [
      "payment_url",
      "redirect_url",
      "checkout_url",
    ]);

    const rawStatus = pickString(data, ["status", "state"])?.toLowerCase();
    const settledSynchronously =
      rawStatus === "success" || rawStatus === "succeeded" || rawStatus === "completed";

    return {
      accepted: true,
      // Une vraie passerelle Mobile Money confirme via webhook → pending par
      // défaut ; on ne fait confiance à un "success" synchrone que s'il est
      // explicite (rare pour du USSD).
      status: settledSynchronously ? "succeeded" : "pending",
      providerReference,
      redirectUrl,
    };
  }
}

function mapChannel(method: string): string {
  switch (method) {
    case "orange_money":
      return "ORANGE";
    case "mtn_momo":
      return "MTN";
    default:
      return "CARD";
  }
}

function describe(input: PaymentIntentInput): string {
  return input.purpose === "subscription"
    ? `OREN abonnement ${input.planKey ?? ""}`.trim()
    : "OREN document express";
}

/** Récupère la 1ʳᵉ chaîne non vide trouvée parmi des clés (au niveau racine
 *  ou sous `data`), de façon tolérante au format de réponse. */
function pickString(value: unknown, keys: string[]): string | undefined {
  const sources: Record<string, unknown>[] = [];
  if (isRecord(value)) {
    sources.push(value);
    if (isRecord(value.data)) sources.push(value.data);
  }
  for (const source of sources) {
    for (const key of keys) {
      const found = source[key];
      if (typeof found === "string" && found.length > 0) return found;
      if (typeof found === "number") return String(found);
    }
  }
  return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
