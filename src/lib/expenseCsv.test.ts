import { describe, expect, it } from "vitest";
import { expensesToGermanCsv } from "./expenseCsv";
import type { Expense } from "@/types";

const catLabel = (id: string) => ({ nonfood: "Non-food", tempfood: "Temporary food" })[id] ?? id;

const base: Expense = {
  id: "e1",
  cityId: "remscheid",
  date: "2026-09-05",
  amount: 119,
  vatRate: 19,
  category: "nonfood",
  subcategory: "Packaging",
  supplier: "Pacovis",
  paymentMethod: "invoice",
  receiptUrl: null,
  enteredBy: "u1",
  enteredByName: "Harsh",
  status: "approved",
  note: "Netto 100,00 € / Brutto 119,00 € – 10x Trinkbecher 0,3l – DELIVERED (O26-42)",
  createdAt: "2026-09-05T10:00:00.000Z",
};

describe("expensesToGermanCsv", () => {
  it("uses ; delimiter, comma decimals and DD.MM.YYYY dates", () => {
    const csv = expensesToGermanCsv([base], catLabel);
    const [, row] = csv.split("\r\n");
    expect(row).toBe('05.09.2026;"Pacovis";"Non-food";"Packaging";"Trinkbecher 0,3l";10;100,00;19%;19,00;119,00;invoice;approved;"O26-42";nein;"Netto 100,00 € / Brutto 119,00 € – 10x Trinkbecher 0,3l – DELIVERED (O26-42)"');
  });

  it("appends a SUMME row totalling Netto, MwSt and Brutto", () => {
    const second: Expense = { ...base, id: "e2", amount: 23.8, vatRate: 19, note: "" };
    const csv = expensesToGermanCsv([base, second], catLabel);
    const sumRow = csv.split("\r\n").at(-1)!;
    expect(sumRow).toBe(";;;;;SUMME;120,00;;22,80;142,80;;;;;");
  });

  it("escapes embedded quotes and leaves product/qty/ref blank for unparsed notes", () => {
    const weird: Expense = { ...base, note: 'Said "thanks" at pickup' };
    const csv = expensesToGermanCsv([weird], catLabel);
    const [, row] = csv.split("\r\n");
    expect(row).toContain('""thanks""');
    const cols = row.split(";");
    expect(cols[4]).toBe('""'); // Produkt
    expect(cols[5]).toBe(""); // Menge
    expect(cols[12]).toBe('""'); // Bestellreferenz
  });

  it("produces exactly one header row, one row per expense, and one SUMME row", () => {
    const csv = expensesToGermanCsv([base, base], catLabel);
    expect(csv.split("\r\n")).toHaveLength(4);
  });
});
