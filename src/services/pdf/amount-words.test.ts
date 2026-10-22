import { describe, expect, it } from "vitest";
import { numberToEnglishWords, numberToFrenchWords } from "./amount-words";

describe("numberToFrenchWords", () => {
  it.each([
    [0, "zéro"],
    [1, "un"],
    [16, "seize"],
    [17, "dix-sept"],
    [21, "vingt et un"],
    [22, "vingt-deux"],
    [71, "soixante et onze"],
    [77, "soixante-dix-sept"],
    [80, "quatre-vingts"],
    [81, "quatre-vingt-un"],
    [91, "quatre-vingt-onze"],
    [99, "quatre-vingt-dix-neuf"],
    [100, "cent"],
    [101, "cent un"],
    [200, "deux cents"],
    [201, "deux cent un"],
    [1000, "mille"],
    [1001, "mille un"],
    [2000, "deux mille"],
    [80000, "quatre-vingt mille"],
    [200000, "deux cent mille"],
    [50000, "cinquante mille"],
    [125500, "cent vingt-cinq mille cinq cents"],
    [1000000, "un million"],
    [2000000, "deux millions"],
    [200000000, "deux cents millions"],
    [80000000, "quatre-vingts millions"],
    [1250000, "un million deux cent cinquante mille"],
    [1000000000, "un milliard"],
    [3450780, "trois millions quatre cent cinquante mille sept cent quatre-vingts"],
  ])("%i → %s", (n, words) => {
    expect(numberToFrenchWords(n)).toBe(words);
  });
});

describe("numberToEnglishWords", () => {
  it.each([
    [0, "zero"],
    [21, "twenty-one"],
    [50000, "fifty thousand"],
    [125500, "one hundred twenty-five thousand five hundred"],
    [2000000, "two million"],
  ])("%i → %s", (n, words) => {
    expect(numberToEnglishWords(n)).toBe(words);
  });
});
