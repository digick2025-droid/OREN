import { describe, expect, it } from "vitest";
import {
  buildReferralLink,
  normalizeReferralCode,
  whatsappShareUrl,
} from "./referral";

describe("normalizeReferralCode", () => {
  it("met en majuscules et retire les espaces", () => {
    expect(normalizeReferralCode("  oren3fa9c2 ")).toBe("OREN3FA9C2");
  });
  it("refuse un code vide, trop court ou avec des caractères spéciaux", () => {
    expect(normalizeReferralCode("")).toBeNull();
    expect(normalizeReferralCode(null)).toBeNull();
    expect(normalizeReferralCode("AB")).toBeNull();
    expect(normalizeReferralCode("OREN-12;DROP")).toBeNull();
  });
});

describe("liens de parrainage", () => {
  it("construit le lien d'inscription avec le code", () => {
    expect(buildReferralLink("https://oren.app", "OREN3FA9C2")).toBe(
      "https://oren.app/inscription?ref=OREN3FA9C2",
    );
  });
  it("encode le message WhatsApp", () => {
    expect(whatsappShareUrl("a b")).toBe("https://wa.me/?text=a%20b");
  });
});
