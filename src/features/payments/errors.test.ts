import { describe, expect, it } from "vitest";
import { paymentErrorMessage } from "./errors";
import { getDict } from "@/lib/i18n/dictionaries";

/**
 * Ce qu'un payeur lit quand l'initiation est refusee. L'enjeu n'est pas la
 * traduction mais la decision : « reessayez » sur un numero invalide fait
 * refaire dix fois la meme tentative perdue d'avance.
 */
const t = getDict("fr");

describe("paymentErrorMessage", () => {
  it("dit quoi corriger quand la faute est cote payeur", () => {
    expect(paymentErrorMessage("INVALID_PHONE", t)).toBe(t.pay_error_phone);
    expect(paymentErrorMessage("METHOD_NOT_SUPPORTED", t)).toBe(
      t.pay_error_method,
    );
    expect(paymentErrorMessage("RATE_LIMITED", t)).toBe(
      t.pay_error_rate_limited,
    );
  });

  it("annonce une indisponibilite quand la passerelle repond de travers", () => {
    expect(paymentErrorMessage("PROVIDER_UNREACHABLE", t)).toBe(
      t.pay_error_unavailable,
    );
    expect(paymentErrorMessage("PROVIDER_HTTP_500", t)).toBe(
      t.pay_error_unavailable,
    );
  });

  it("ne montre jamais au payeur le detail d'une erreur de configuration", () => {
    expect(paymentErrorMessage("PROVIDER_NOT_CONFIGURED", t)).toBe(
      t.pay_error_config,
    );
    // Le message de la passerelle est enregistre sur l'intention, pas affiche :
    // « Invalid API key » ne dit rien au payeur et tout a un curieux.
    expect(paymentErrorMessage("PROVIDER_HTTP_401: Invalid API key", t)).toBe(
      t.pay_error_unavailable,
    );
  });

  it("masque un code machine inconnu mais laisse passer un motif redige", () => {
    expect(paymentErrorMessage("SOME_NEW_CODE", t)).toBe(t.pay_failed);
    expect(paymentErrorMessage("Solde insuffisant", t)).toBe(
      "Solde insuffisant",
    );
  });

  it("retombe sur le message generique sans code", () => {
    expect(paymentErrorMessage(undefined, t)).toBe(t.pay_failed);
  });
});
