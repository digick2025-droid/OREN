import type {
  PaymentProvider,
  PaymentIntentInput,
  PaymentInitiation,
  ProviderTransactionStatus,
} from "../types";
import {
  errorMessage,
  normalizeStatus,
  toKPayPhone,
  toKPayProvider,
} from "./payload";

/**
 * Fournisseur K-PAY — Mobile Money **sans quitter l'application**.
 *
 * C'est la différence de fond avec CamerPay : là où CamerPay impose une
 * redirection vers sa page hébergée, K-PAY expose un mode « USSD » qui pousse
 * directement la demande de validation sur le téléphone du client depuis notre
 * serveur. Le client saisit son numéro chez nous, reçoit la notification, tape
 * son code secret, et n'a jamais vu d'autre interface que la nôtre.
 *
 *   POST https://admin.kpay.site/api/v1/payments/init
 *   X-API-Key: …
 *   X-Secret-Key: …
 *   { "amount": 500, "provider": "ORANGE_CMR",
 *     "phoneNumber": "237699123456", "externalId": "OREN-EXP-…" }
 *   → 201 { "id": "pay_…", "reference": "KPAY-…", "status": "PENDING" }
 *
 * Aucune `pay_url` dans la réponse : `initiate()` ne renvoie donc jamais de
 * `redirectUrl`, et l'appelant sait qu'il doit attendre sur place.
 *
 * La confirmation arrive par le webhook signé (`/api/payments/webhook/kpay`)
 * ET par la lecture de statut ci-dessous — les deux passent par le même
 * règlement idempotent, celui qui arrive en premier gagne.
 *
 * Variables d'environnement (serveur uniquement) :
 *   - KPAY_API_URL    : racine de l'API (défaut : https://admin.kpay.site).
 *   - KPAY_API_KEY    : en-tête X-API-Key.
 *   - KPAY_SECRET_KEY : en-tête X-Secret-Key.
 */

const DEFAULT_API_URL = "https://admin.kpay.site";

export class KPayProvider implements PaymentProvider {
  readonly name = "kpay";

  private readonly apiUrl: string;
  private readonly apiKey: string;
  private readonly secretKey: string;

  constructor() {
    this.apiUrl = (process.env.KPAY_API_URL || DEFAULT_API_URL).replace(
      /\/+$/,
      "",
    );
    this.apiKey = process.env.KPAY_API_KEY ?? "";
    this.secretKey = process.env.KPAY_SECRET_KEY ?? "";
  }

  private get headers(): Record<string, string> {
    return {
      "X-API-Key": this.apiKey,
      "X-Secret-Key": this.secretKey,
      Accept: "application/json",
    };
  }

  async initiate(input: PaymentIntentInput): Promise<PaymentInitiation> {
    const failed = (error: string): PaymentInitiation => ({
      accepted: false,
      status: "failed",
      providerReference: "",
      error,
    });

    if (!this.apiKey || !this.secretKey) {
      return failed("PROVIDER_NOT_CONFIGURED");
    }

    // Le mode USSD exige un opérateur Mobile Money : la carte n'a pas de
    // chemin ici (elle passerait par la page hébergée, qu'on n'utilise pas).
    const kpayProvider = toKPayProvider(input.method);
    if (!kpayProvider) return failed("METHOD_NOT_SUPPORTED");

    const phoneNumber = input.phone ? toKPayPhone(input.phone) : "";
    if (phoneNumber.replace(/[^\d]/g, "").length < 11) {
      return failed("INVALID_PHONE");
    }

    const payload: Record<string, unknown> = {
      amount: input.amount,
      provider: kpayProvider,
      phoneNumber,
      // Notre référence interne sert de clé d'idempotence côté K-PAY : un
      // second appel avec la même valeur est refusé (409) au lieu de créer
      // un doublon. Elle nous revient telle quelle dans le webhook.
      externalId: input.reference,
      description:
        input.purpose === "subscription"
          ? `OREN — abonnement ${input.planKey ?? ""}`.trim()
          : "OREN — document express",
    };
    if (input.metadata?.customerName) {
      payload.customerName = input.metadata.customerName;
    }
    if (input.metadata?.customerEmail) {
      payload.customerEmail = input.metadata.customerEmail;
    }

    let response: Response;
    try {
      response = await fetch(`${this.apiUrl}/api/v1/payments/init`, {
        method: "POST",
        headers: { ...this.headers, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        cache: "no-store",
      });
    } catch {
      return failed("PROVIDER_UNREACHABLE");
    }

    let data: unknown = null;
    try {
      data = await response.json();
    } catch {
      // Corps illisible : seul le code HTTP nous renseigne encore.
      if (!response.ok) return failed(`PROVIDER_HTTP_${response.status}`);
      return failed("PROVIDER_BAD_RESPONSE");
    }

    if (!response.ok) {
      // 409 = ce `externalId` a déjà servi. Ne jamais le traiter comme un
      // échec de paiement : la transaction d'origine existe et peut très bien
      // être en train d'aboutir. On laisse la réconciliation trancher.
      if (response.status === 409) return failed("DUPLICATE_REFERENCE");
      return failed(
        errorMessage(data) ?? `PROVIDER_HTTP_${response.status}`,
      );
    }

    const body = (data ?? {}) as Record<string, unknown>;
    // On préfère `reference` (KPAY-…) à `id` : les deux sont acceptés par la
    // lecture de statut, mais c'est `reference` que porte le webhook.
    const providerReference =
      asString(body.reference) ?? asString(body.id) ?? "";
    if (!providerReference) return failed("PROVIDER_BAD_RESPONSE");

    const status = normalizeStatus(asString(body.status));
    if (status === "failed") {
      return {
        accepted: false,
        status: "failed",
        providerReference,
        error: errorMessage(data) ?? "PROVIDER_REFUSED",
      };
    }

    return {
      accepted: true,
      // K-PAY répond PENDING : la demande vient de partir sur le téléphone.
      // Pas de `redirectUrl` — le client reste chez nous et attend.
      status,
      providerReference,
    };
  }

  /**
   * Lit l'état réel d'une transaction : `GET /api/v1/payments/{id}`.
   * Accepte l'`id` comme la `reference`.
   *
   * Renvoie `null` dès que l'état n'est pas déterminable — l'appelant ne doit
   * alors rien trancher, surtout pas un échec.
   */
  async checkStatus(
    providerReference: string,
  ): Promise<ProviderTransactionStatus | null> {
    if (!providerReference || !this.apiKey || !this.secretKey) return null;

    let response: Response;
    try {
      response = await fetch(
        `${this.apiUrl}/api/v1/payments/${encodeURIComponent(providerReference)}`,
        { headers: this.headers, cache: "no-store" },
      );
    } catch {
      return null;
    }
    if (!response.ok) return null;

    let data: unknown;
    try {
      data = await response.json();
    } catch {
      return null;
    }

    const body = (data ?? {}) as Record<string, unknown>;
    const rawStatus = asString(body.status);
    if (!rawStatus) return null;

    const amount = Number(body.amount);
    return {
      status: normalizeStatus(rawStatus),
      // `amount` est le montant demandé, pas le net encaissé (`netAmount`,
      // commission déduite) : c'est bien celui-ci qu'on compare à l'intention.
      amount: Number.isFinite(amount) ? amount : undefined,
      failureReason: asString(body.failureReason),
      failureCode: rawStatus.toUpperCase() === "CANCELLED" ? "CANCELLED" : undefined,
    };
  }
}

function asString(value: unknown): string | undefined {
  if (typeof value === "string" && value.length > 0) return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return undefined;
}
