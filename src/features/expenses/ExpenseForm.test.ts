import { describe, expect, it } from "vitest";
import { defaultVat, parseAmount } from "./ExpenseForm";

describe("parseAmount", () => {
  it("accepts German comma decimals", () => {
    expect(parseAmount("62,40")).toBe(62.4);
  });
  it("accepts plain dot decimals", () => {
    expect(parseAmount("62.40")).toBe(62.4);
  });
  it("accepts German thousands + comma decimal", () => {
    expect(parseAmount("1.234,50")).toBe(1234.5);
  });
  it("strips a euro sign and surrounding whitespace", () => {
    expect(parseAmount("€ 62")).toBe(62);
  });
  it("returns NaN for garbage input", () => {
    expect(Number.isNaN(parseAmount("abc"))).toBe(true);
  });
});

describe("defaultVat", () => {
  it("defaults temporary food to 7 %", () => {
    expect(defaultVat("tempfood", "Spot buy")).toBe(7);
  });
  it("defaults employee costs to 0 %", () => {
    expect(defaultVat("employees", "Payroll")).toBe(0);
  });
  it("defaults rent/insurance/licences to 0 % regardless of category", () => {
    expect(defaultVat("fixed", "Rent")).toBe(0);
    expect(defaultVat("fixed", "Insurance")).toBe(0);
    expect(defaultVat("fixed", "Licences")).toBe(0);
  });
  it("defaults everything else to 19 %", () => {
    expect(defaultVat("nonfood", "Packaging")).toBe(19);
    expect(defaultVat("fixed", "Maintenance")).toBe(19);
  });
});
