import { describe, expect, it } from "vitest";
import { normalizeTransactionRef } from "./manual-payment";

describe("normalizeTransactionRef", () => {
  it("accepte une référence Orange Money et la normalise", () => {
    expect(normalizeTransactionRef(" mp231022.1530.a12345 ")).toBe(
      "MP231022.1530.A12345",
    );
  });

  it("accepte un identifiant MTN numérique, espaces retirés", () => {
    expect(normalizeTransactionRef("9876 5432 101")).toBe("98765432101");
  });

  it("refuse une saisie trop courte, sans chiffres ou avec des caractères inattendus", () => {
    expect(normalizeTransactionRef("12345")).toBeNull();
    expect(normalizeTransactionRef("BONJOUR")).toBeNull();
    expect(normalizeTransactionRef("1234;DROP")).toBeNull();
    expect(normalizeTransactionRef("")).toBeNull();
    expect(normalizeTransactionRef(undefined)).toBeNull();
  });
});
