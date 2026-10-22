import { describe, expect, it } from "vitest";
import { ACCOUNT_FUNNEL, buildFunnel, formatDuration } from "./funnel";

describe("buildFunnel", () => {
  it("calcule la part du total et le passage d'une étape à l'autre", () => {
    const rows = buildFunnel(ACCOUNT_FUNNEL, {
      landing_view: 200,
      signup_view: 50,
      signup_completed: 40,
      builder_opened: 30,
      document_generated: 20,
      document_shared: 10,
    });
    expect(rows[0]).toMatchObject({ devices: 200, ofFirst: 100, fromPrevious: null });
    expect(rows[1]).toMatchObject({ devices: 50, ofFirst: 25, fromPrevious: 25 });
    expect(rows[5]).toMatchObject({ devices: 10, ofFirst: 5, fromPrevious: 50 });
  });

  it("tient sans données (aucune division par zéro)", () => {
    const rows = buildFunnel(ACCOUNT_FUNNEL, {});
    expect(rows.every((r) => r.devices === 0 && r.ofFirst === 0)).toBe(true);
    expect(rows[1]?.fromPrevious).toBe(0);
  });
});

describe("formatDuration", () => {
  it("formate secondes, minutes et heures", () => {
    expect(formatDuration(45)).toBe("45 s");
    expect(formatDuration(95)).toBe("1 min 35 s");
    expect(formatDuration(120)).toBe("2 min");
    expect(formatDuration(7500)).toBe("2 h 05 min");
  });

  it("affiche un tiret sans mesure", () => {
    expect(formatDuration(null)).toBe("—");
    expect(formatDuration(undefined)).toBe("—");
  });
});
