import type {
  PaymentProvider,
  PaymentIntentInput,
  PaymentInitiation,
} from "../types";
import { normalizeStatus, pickString } from "./payload";

/**
 * Fournisseur CamerPay (Mobile Money Cameroun).
 *
 * Contrat repris de la doc « API REST » du tableau de bord CamerPay :
 *
 *   POST https://camerpay.biz/api/payment/initiate
 *   Authorization: Bearer <token>
 *   {
 *     "amount": 5000, "currency": "XAF",
 *     "merchant_invoice_id": "FACTURE-001",
 *     "customer_name": "…", "customer_email": "…", "customer_phone": "699123456",
 *     "merchant_callback_url": "https://…/api/payments/webhook",
 *     "merchant_return_url": "https://…/paiement/retour",
 *     "source": "api"
 *   }
 *   → { "success": true, "transaction_uuid": "…", "pay_url": "https://camerpay.biz/pay/…", "status": "pending" }
 *
 * ⚠️ Parcours par REDIRECTION : CamerPay ne pousse pas de demande USSD depuis
 * notre appel. Le client doit être envoyé sur `pay_url`, y choisir son moyen
 * de paiement, puis il revient sur `merchant_return_url`. La confirmation, elle,
 * arrive indépendamment sur `merchant_callback_url` (voir webhook).
 *
 * `merchant_return_url` reçoit notre référence en paramètre `ref` (voir
 * `withReference`), pour que `/paiement/retour` sache quelle intention
 * vérifier. CamerPay peut ajouter ses propres paramètres à la redirection ;
 * on ne les lit jamais — seul le webhook signé fait foi du résultat.
 *
 * Variables d'environnement (serveur uniquement) :
 *   - CAMERPAY_API_URL      : endpoint d'initiation.
 *   - CAMERPAY_API_KEY      : token API, envoyé en `Authorization: Bearer`.
 *   - CAMERPAY_CALLBACK_URL : URL publique de notre webhook.
 *   - CAMERPAY_RETURN_URL   : page de retour après paiement.
 */
export class CamerPayProvider implements PaymentProvider {
  readonly name = "camerpay";

  private readonly apiUrl: string;
  private readonly apiKey: string;
  private readonly callbackUrl?: string;
  private readonly returnUrl?: string;

  constructor() {
    this.apiUrl = process.env.CAMERPAY_API_URL ?? "";
    this.apiKey = process.env.CAMERPAY_API_KEY ?? "";
    this.callbackUrl = process.env.CAMERPAY_CALLBACK_URL || undefined;
    this.returnUrl = process.env.CAMERPAY_RETURN_URL || undefined;
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

    const payload: Record<string, unknown> = {
      amount: input.amount,
      currency: input.currency,
      // Notre référence interne : CamerPay nous la renvoie telle quelle dans
      // le callback sous le nom `invoice_id`. C'est le lien init ⇆ confirmation.
      merchant_invoice_id: input.reference,
      customer_phone: input.phone ? toLocalPhone(input.phone) : undefined,
      customer_name: input.metadata?.customerName,
      customer_email: input.metadata?.customerEmail,
      source: "api",
    };
    if (this.callbackUrl) payload.merchant_callback_url = this.callbackUrl;
    if (this.returnUrl) {
      payload.merchant_return_url = withReference(this.returnUrl, input.reference);
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
        // Les clés `undefined` sont omises par JSON.stringify : on n'envoie
        // pas de champs vides pour les infos client qu'on n'a pas.
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
      return {
        accepted: false,
        status: "failed",
        providerReference: "",
        error: "PROVIDER_BAD_RESPONSE",
      };
    }

    // `success: false` ⇒ refus applicatif malgré un HTTP 200.
    if (
      typeof data === "object" &&
      data !== null &&
      (data as Record<string, unknown>).success === false
    ) {
      return {
        accepted: false,
        status: "failed",
        providerReference: "",
        error:
          pickString(data, ["message", "error"]) ?? "PROVIDER_REFUSED",
      };
    }

    const redirectUrl = pickString(data, ["pay_url"]);
    if (!redirectUrl) {
      // Sans URL de paiement le client n'a aucun moyen de payer : mieux vaut
      // un échec net qu'une intention laissée en attente pour toujours.
      return {
        accepted: false,
        status: "failed",
        providerReference: pickString(data, ["transaction_uuid"]) ?? "",
        error: "PROVIDER_NO_PAY_URL",
      };
    }

    return {
      accepted: true,
      // CamerPay répond toujours `pending` ici : le client n'a pas encore payé.
      // Seul le callback signé peut faire basculer en succès.
      status: normalizeStatus(pickString(data, ["status"])),
      providerReference:
        pickString(data, ["transaction_uuid"]) ?? input.reference,
      redirectUrl,
    };
  }
}

/**
 * Format attendu par CamerPay : 9 chiffres sans indicatif (« 699123456 »).
 * Nos numéros circulent en E.164 (« +237699123456 ») ; on retire donc
 * l'indicatif pays s'il est présent.
 */
function toLocalPhone(phone: string): string {
  const digits = phone.replace(/[^\d]/g, "");
  return digits.startsWith("237") && digits.length > 9
    ? digits.slice(3)
    : digits;
}

/**
 * Ajoute `?ref=<reference>` à l'URL de retour configurée. Si `CAMERPAY_RETURN_URL`
 * est mal formée (erreur de config), on renvoie l'URL brute plutôt que de faire
 * échouer toute l'initiation pour un problème d'affichage du retour.
 */
function withReference(returnUrl: string, reference: string): string {
  try {
    const url = new URL(returnUrl);
    url.searchParams.set("ref", reference);
    return url.toString();
  } catch {
    return returnUrl;
  }
}
