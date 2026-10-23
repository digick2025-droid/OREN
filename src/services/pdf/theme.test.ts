import { describe, expect, it } from "vitest";
import { buildTheme, contrast, normalizeHex, servicesFooter } from "./theme";
import { PDF_STRINGS } from "./strings";
import type { PdfCompany } from "./types";

describe("normalizeHex", () => {
  it("étend #RGB en #RRGGBB", () => {
    expect(normalizeHex("#f60")).toBe("#FF6600");
  });

  it("retombe sur la couleur par défaut si la valeur est invalide", () => {
    expect(normalizeHex("rouge")).toBe("#0F172A");
  });
});

describe("buildTheme — lisibilité quelle que soit la couleur", () => {
  it("garde du texte blanc sur une couleur foncée", () => {
    expect(buildTheme("#0F172A").onBrand).toBe("#FFFFFF");
  });

  it("passe en texte sombre sur une couleur claire (jaune)", () => {
    const theme = buildTheme("#F5C518");
    expect(theme.onBrand).toBe("#0F172A");
    expect(contrast(theme.onBrand, theme.brand)).toBeGreaterThanOrEqual(4.5);
  });

  it("assombrit la couleur des titres jusqu'à un contraste lisible sur blanc", () => {
    for (const color of ["#F5C518", "#FFE4B5", "#7DD3FC", "#FF6B57", "#16A34A"]) {
      expect(contrast(buildTheme(color).ink, "#FFFFFF")).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("ne touche pas une couleur déjà lisible", () => {
    expect(buildTheme("#1D4ED8").ink).toBe("#1D4ED8");
  });
});

describe("servicesFooter", () => {
  const company = {
    services: [] as string[],
    footerNote: "",
  } as unknown as PdfCompany;
  const theme = buildTheme("#16A34A");

  it("n'affiche rien sans services ni mention", () => {
    expect(servicesFooter(company, theme, PDF_STRINGS.fr)).toBe("");
  });

  it("échappe les services saisis", () => {
    const html = servicesFooter(
      { ...company, services: ["Plomberie", "<b>Élec</b>"] },
      theme,
      PDF_STRINGS.fr,
    );
    expect(html).toContain("Nos services");
    expect(html).toContain("Plomberie");
    expect(html).toContain("&lt;b&gt;Élec&lt;/b&gt;");
  });
});
