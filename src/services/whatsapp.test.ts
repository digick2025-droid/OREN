import { describe, expect, it } from "vitest";
import { buildWhatsAppLink, toInternationalPhone } from "./whatsapp";

describe("toInternationalPhone", () => {
  it("préfixe l'indicatif Cameroun sur un numéro local", () => {
    expect(toInternationalPhone("6 90 00 00 00")).toBe("237690000000");
    expect(toInternationalPhone("677123456")).toBe("237677123456");
  });

  it("garde un numéro déjà international (+)", () => {
    expect(toInternationalPhone("+33 7 12 34 56 78")).toBe("33712345678");
    expect(toInternationalPhone("+237 690 00 00 00")).toBe("237690000000");
  });

  it("gère le préfixe international 00", () => {
    expect(toInternationalPhone("00237690000000")).toBe("237690000000");
  });

  it("ne double pas l'indicatif déjà présent sans +", () => {
    expect(toInternationalPhone("237690000000")).toBe("237690000000");
  });

  it("retire le 0 national de tête avant de préfixer", () => {
    expect(toInternationalPhone("0690000000", "33")).toBe("33690000000");
  });

  it("renvoie une chaîne vide si aucun chiffre", () => {
    expect(toInternationalPhone("")).toBe("");
    expect(toInternationalPhone("   ")).toBe("");
  });
});

describe("buildWhatsAppLink", () => {
  it("construit un lien wa.me avec numéro international et message encodé", () => {
    const link = buildWhatsAppLink("6 90 00 00 00", "Bonjour à toi");
    expect(link).toContain("https://wa.me/237690000000?text=");
    expect(link).toContain("Bonjour%20%C3%A0%20toi");
  });

  it("sans numéro, ouvre wa.me sans destinataire", () => {
    expect(buildWhatsAppLink("", "Salut")).toBe(
      "https://wa.me/?text=Salut",
    );
  });
});
