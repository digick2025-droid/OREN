import { describe, expect, it } from "vitest";
import { normalizeStatus, pickString } from "./payload";

describe("pickString — lecture tolérante des charges CamerPay", () => {
  it("lit une clé à la racine", () => {
    expect(pickString({ reference: "OREN-SUB-1" }, ["reference"])).toBe(
      "OREN-SUB-1",
    );
  });

  it("lit une clé imbriquée sous data", () => {
    expect(pickString({ data: { transaction_id: "CP-9" } }, ["transaction_id"]))
      .toBe("CP-9");
  });

  it("respecte l'ordre des clés candidates", () => {
    const payload = { id: "second", reference: "first" };
    expect(pickString(payload, ["reference", "id"])).toBe("first");
  });

  it("préfère la racine à data pour une même clé", () => {
    const payload = { reference: "racine", data: { reference: "imbriquee" } };
    expect(pickString(payload, ["reference"])).toBe("racine");
  });

  it("convertit un nombre en chaîne", () => {
    expect(pickString({ id: 42 }, ["id"])).toBe("42");
  });

  it("ignore une chaîne vide et poursuit la recherche", () => {
    expect(pickString({ reference: "", order_id: "X" }, ["reference", "order_id"]))
      .toBe("X");
  });

  it("renvoie undefined si rien ne correspond", () => {
    expect(pickString({ autre: "x" }, ["reference"])).toBeUndefined();
  });

  it("tolère une charge non-objet", () => {
    expect(pickString(null, ["reference"])).toBeUndefined();
    expect(pickString("texte", ["reference"])).toBeUndefined();
  });
});

describe("normalizeStatus — statut fournisseur → statut OREN", () => {
  it.each(["success", "successful", "succeeded", "completed", "confirmed", "paid"])(
    "reconnaît le succès « %s »",
    (raw) => {
      expect(normalizeStatus(raw)).toBe("succeeded");
    },
  );

  it.each(["failed", "failure", "declined", "cancelled", "canceled", "expired", "rejected"])(
    "reconnaît l'échec « %s »",
    (raw) => {
      expect(normalizeStatus(raw)).toBe("failed");
    },
  );

  it("est insensible à la casse et aux espaces", () => {
    expect(normalizeStatus("  SUCCESS ")).toBe("succeeded");
    expect(normalizeStatus("Failed")).toBe("failed");
  });

  // Garde-fou central : un statut inconnu ne doit JAMAIS accorder une offre.
  it("retombe sur pending pour un statut inconnu", () => {
    expect(normalizeStatus("processing")).toBe("pending");
    expect(normalizeStatus("en_cours")).toBe("pending");
  });

  it("retombe sur pending pour un statut absent ou vide", () => {
    expect(normalizeStatus(undefined)).toBe("pending");
    expect(normalizeStatus("")).toBe("pending");
  });
});
