import { describe, expect, it } from "vitest";
import { netOf, parseExpenseNote, productKey } from "./expenseNotes";

describe("netOf", () => {
  it("derives net from gross at 19 %", () => {
    expect(netOf(119, 19)).toBe(100);
  });
  it("derives net from gross at 7 %", () => {
    expect(netOf(107, 7)).toBeCloseTo(100, 2);
  });
  it("is a no-op at 0 % (reverse charge / payroll / rent)", () => {
    expect(netOf(250, 0)).toBe(250);
  });
  it("rounds to 2dp", () => {
    expect(netOf(10, 19)).toBe(8.4); // 8.403... -> 8.40
  });
});

describe("parseExpenseNote", () => {
  it("parses the standard DELIVERED note with an order reference", () => {
    const r = parseExpenseNote("Netto 123,45 € / Brutto 146,90 € – 3x Pacovis Trinkbecher 0,3l – DELIVERED (O26-1234)");
    expect(r).toEqual({ qty: 3, productName: "Pacovis Trinkbecher 0,3l", deliveryStatus: "DELIVERED", orderRef: "O26-1234" });
  });

  it("parses an ORDERED note without a reference", () => {
    const r = parseExpenseNote("Netto 10,00 € / Brutto 11,90 € – 1x Servietten – ORDERED");
    expect(r).toEqual({ qty: 1, productName: "Servietten", deliveryStatus: "ORDERED", orderRef: null });
  });

  it("parses a 0 % reverse-charge style note (no VAT, netto == brutto)", () => {
    const r = parseExpenseNote("Netto 50,00 € / Brutto 50,00 € – 2x Imported goods – DELIVERED (DPOW99)");
    expect(r).toEqual({ qty: 2, productName: "Imported goods", deliveryStatus: "DELIVERED", orderRef: "DPOW99" });
  });

  it("returns null for free-text notes that don't match the format", () => {
    expect(parseExpenseNote("Forgot the receipt, will upload later")).toBeNull();
    expect(parseExpenseNote("")).toBeNull();
    expect(parseExpenseNote(null)).toBeNull();
    expect(parseExpenseNote(undefined)).toBeNull();
  });

  it("rejects a zero or missing quantity rather than guessing", () => {
    expect(parseExpenseNote("Netto 10,00 € / Brutto 11,90 € – 0x Nothing – ORDERED")).toBeNull();
  });
});

describe("productKey", () => {
  it("lowercases and trims", () => {
    expect(productKey("  Pacovis Trinkbecher  ")).toBe("pacovis trinkbecher");
  });
  it("collapses repeated whitespace", () => {
    expect(productKey("Pacovis   Trinkbecher")).toBe("pacovis trinkbecher");
  });
  it("strips trademark/registered symbols", () => {
    expect(productKey("Tork® Papier™")).toBe("tork papier");
  });
  it("drops a single trailing period or comma", () => {
    expect(productKey("Trinkbecher 0,3l.")).toBe("trinkbecher 0,3l");
  });
  it("treats differently-cased/spaced variants as the same key", () => {
    expect(productKey("METRO Trinkbecher")).toBe(productKey("  metro   trinkbecher  "));
  });
});
