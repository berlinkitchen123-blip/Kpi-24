import { describe, expect, it } from "vitest";
import { dateDE, numDE } from "./format";

describe("numDE", () => {
  it("formats with a comma decimal and no thousands grouping", () => {
    expect(numDE(1035)).toBe("1035,00");
    expect(numDE(62.4)).toBe("62,40");
    expect(numDE(0)).toBe("0,00");
  });

  it("rounds to 2 decimal places", () => {
    expect(numDE(1.005)).toBe("1,00"); // toFixed banker's rounding edge case, documented behaviour
    expect(numDE(9.999)).toBe("10,00");
  });

  it("keeps the minus sign for negative numbers", () => {
    expect(numDE(-12.3)).toBe("-12,30");
  });
});

describe("dateDE", () => {
  it("converts ISO dates to German DD.MM.YYYY", () => {
    expect(dateDE("2026-09-05")).toBe("05.09.2026");
    expect(dateDE("2026-12-31")).toBe("31.12.2026");
  });
});
