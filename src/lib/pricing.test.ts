import { describe, expect, it } from "vitest";
import {
  annualPrice,
  breakEvenDocuments,
  periodPrice,
  pricePerDay,
  pricePerDocument,
} from "./pricing";

describe("pricing", () => {
  it("ramène le mensuel à la journée", () => {
    expect(pricePerDay(2900)).toBe(97);
    expect(pricePerDay(4900)).toBe(164);
  });

  it("calcule le prix d'un document dans le forfait", () => {
    expect(pricePerDocument(2900, 25)).toBe(116);
    expect(pricePerDocument(4900, null)).toBeNull();
  });

  it("donne le seuil de rentabilité face à l'achat à l'unité", () => {
    expect(breakEvenDocuments(2900, 500)).toBe(6);
    expect(breakEvenDocuments(2900, 0)).toBe(Infinity);
  });
});

describe("annualPrice", () => {
  it("facture 10 mois pour 12", () => {
    expect(annualPrice(2900)).toBe(29000);
    expect(annualPrice(4900)).toBe(49000);
  });
});

describe("periodPrice", () => {
  const pro = { price_fcfa: 2900, week_price_fcfa: 950 };

  it("donne le prix de chaque durée", () => {
    expect(periodPrice(pro, "weekly")).toBe(950);
    expect(periodPrice(pro, "monthly")).toBe(2900);
    expect(periodPrice(pro, "annual")).toBe(29000);
  });

  it("refuse la semaine quand l'offre n'a pas de prix à la semaine", () => {
    expect(periodPrice({ price_fcfa: 2900, week_price_fcfa: null }, "weekly")).toBeNull();
  });

  it("garde le mois plus avantageux que 4 semaines", () => {
    expect(4 * (periodPrice(pro, "weekly") ?? 0)).toBeGreaterThan(2900);
  });
});
