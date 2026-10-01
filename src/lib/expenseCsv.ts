import { dateDE, numDE } from "@/lib/format";
import { netOf, parseExpenseNote } from "@/lib/expenseNotes";
import type { Expense } from "@/types";

const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;

/**
 * Builds a German-Excel-friendly CSV: ";" delimiter, comma decimals, DD.MM.YYYY
 * dates, CRLF line endings, and a trailing SUMME row. Caller adds the UTF-8 BOM.
 */
export function expensesToGermanCsv(rows: Expense[], catLabel: (id: string) => string): string {
  const head = ["Datum", "Lieferant", "Kategorie", "Typ", "Produkt", "Menge", "Netto", "MwSt-Satz", "MwSt-Betrag", "Brutto", "Bezahlt mit", "Status", "Bestellreferenz", "Beleg", "Notiz"];
  const lines = rows.map((e) => {
    const net = netOf(e.amount, e.vatRate);
    const parsed = parseExpenseNote(e.note);
    return [
      dateDE(e.date),
      esc(e.supplier),
      esc(catLabel(e.category)),
      esc(e.subcategory),
      esc(parsed?.productName ?? ""),
      parsed ? String(parsed.qty) : "",
      numDE(net),
      `${e.vatRate}%`,
      numDE(e.amount - net),
      numDE(e.amount),
      e.paymentMethod,
      e.status,
      esc(parsed?.orderRef ?? ""),
      e.receiptUrl ? "ja" : "nein",
      esc(e.note || ""),
    ].join(";");
  });
  const t = rows.reduce(
    (s, e) => {
      const net = netOf(e.amount, e.vatRate);
      s.net += net;
      s.gross += e.amount;
      s.vat += e.amount - net;
      return s;
    },
    { net: 0, vat: 0, gross: 0 },
  );
  const sumRow = ["", "", "", "", "", "SUMME", numDE(t.net), "", numDE(t.vat), numDE(t.gross), "", "", "", "", ""].join(";");
  return [head.join(";"), ...lines, sumRow].join("\r\n");
}
