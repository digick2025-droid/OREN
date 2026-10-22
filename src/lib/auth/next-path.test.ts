import { describe, expect, it } from "vitest";
import { safeNextPath } from "./next-path";

describe("safeNextPath", () => {
  it("garde un chemin interne avec sa requête", () => {
    expect(safeNextPath("/nouveau?type=devis")).toBe("/nouveau?type=devis");
  });

  it("refuse les redirections vers une autre origine", () => {
    expect(safeNextPath("//evil.com")).toBeNull();
    expect(safeNextPath("/\\evil.com")).toBeNull();
    expect(safeNextPath("https://evil.com")).toBeNull();
  });

  it("refuse l'absence de valeur", () => {
    expect(safeNextPath(null)).toBeNull();
    expect(safeNextPath("")).toBeNull();
  });
});
