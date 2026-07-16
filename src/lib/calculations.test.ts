import { describe, expect, it } from "vitest";
import {
  canCreateDocument,
  computeTotals,
  formatDocumentNumber,
  lineTotal,
} from "./calculations";

describe("lineTotal", () => {
  it("multiplie quantité × prix unitaire", () => {
    expect(lineTotal({ quantity: 8, unit_price: 2500 })).toBe(20000);
  });

  it("arrondit au franc", () => {
    expect(lineTotal({ quantity: 1.5, unit_price: 333 })).toBe(500);
  });

  it("tolère les valeurs invalides", () => {
    expect(lineTotal({ quantity: NaN, unit_price: 100 })).toBe(0);
  });
});

describe("computeTotals — calcul des totaux", () => {
  const items = [
    { quantity: 10, unit_price: 3500 }, // 35 000
    { quantity: 1, unit_price: 20000 }, // 20 000
  ];

  it("calcule le sous-total", () => {
    expect(computeTotals(items).subtotal).toBe(55000);
  });

  it("sans TVA : total = sous-total − remise", () => {
    const totals = computeTotals(items, { discount: 5000 });
    expect(totals.net).toBe(50000);
    expect(totals.vatAmount).toBe(0);
    expect(totals.total).toBe(50000);
  });

  it("borne la remise au sous-total", () => {
    const totals = computeTotals(items, { discount: 999999 });
    expect(totals.discount).toBe(55000);
    expect(totals.total).toBe(0);
  });

  it("ignore une remise négative", () => {
    expect(computeTotals(items, { discount: -100 }).discount).toBe(0);
  });

  it("document vide : tout à zéro", () => {
    const totals = computeTotals([]);
    expect(totals.subtotal).toBe(0);
    expect(totals.total).toBe(0);
  });
});

describe("computeTotals — TVA", () => {
  const items = [{ quantity: 1, unit_price: 100000 }];

  it("applique le taux de TVA sur le montant HT", () => {
    const totals = computeTotals(items, { vatEnabled: true, vatRate: 18 });
    expect(totals.vatAmount).toBe(18000);
    expect(totals.total).toBe(118000);
  });

  it("TVA calculée après remise", () => {
    const totals = computeTotals(items, {
      discount: 50000,
      vatEnabled: true,
      vatRate: 18,
    });
    expect(totals.net).toBe(50000);
    expect(totals.vatAmount).toBe(9000);
    expect(totals.total).toBe(59000);
  });

  it("TVA au taux camerounais 19,25 % arrondie au franc", () => {
    const totals = computeTotals([{ quantity: 1, unit_price: 10101 }], {
      vatEnabled: true,
      vatRate: 19.25,
    });
    expect(totals.vatAmount).toBe(Math.round(10101 * 0.1925));
  });

  it("non assujetti : taux ignoré", () => {
    const totals = computeTotals(items, { vatEnabled: false, vatRate: 18 });
    expect(totals.vatRate).toBe(0);
    expect(totals.vatAmount).toBe(0);
    expect(totals.total).toBe(100000);
  });
});

describe("formatDocumentNumber — numérotation", () => {
  it("préfixe DEV- pour un devis", () => {
    expect(formatDocumentNumber("devis", 1)).toBe("DEV-001");
  });

  it("préfixe FAC- pour une facture", () => {
    expect(formatDocumentNumber("facture", 12)).toBe("FAC-012");
  });

  it("dépasse 3 chiffres sans tronquer", () => {
    expect(formatDocumentNumber("devis", 1234)).toBe("DEV-1234");
  });
});

describe("canCreateDocument — quota d'abonnement", () => {
  it("autorise sous le quota", () => {
    expect(canCreateDocument(24, 25)).toBe(true);
  });

  it("bloque au quota atteint", () => {
    expect(canCreateDocument(25, 25)).toBe(false);
  });

  it("quota null = illimité (Business)", () => {
    expect(canCreateDocument(10000, null)).toBe(true);
  });

  it("quota 0 = paiement à l'usage (Express)", () => {
    expect(canCreateDocument(50, 0)).toBe(true);
  });
});
