// Parses the structured notes written by QuickAdd / the invoice-import flow:
//   "Netto 123,45 € / Brutto 146,90 € – 3x Pacovis Trinkbecher 0,3l – DELIVERED (O26-1234)"
// so qty / product / delivery status / order reference can be recovered without a
// schema migration (amount/vatRate on the Expense doc remain the source of truth for money).

export interface ParsedNote {
  qty: number;
  productName: string;
  deliveryStatus: "ORDERED" | "DELIVERED";
  orderRef: string | null;
}

const NOTE_RE = /Netto\s*[\d.,]+\s*€\s*\/\s*Brutto\s*[\d.,]+\s*€\s*[–-]\s*(\d+)\s*x\s*(.+?)\s*[–-]\s*(ORDERED|DELIVERED)\b(?:\s*\(([^)]+)\))?/i;

export function parseExpenseNote(note: string | null | undefined): ParsedNote | null {
  if (!note) return null;
  const m = NOTE_RE.exec(note);
  if (!m) return null;
  const qty = Number(m[1]);
  if (!Number.isFinite(qty) || qty <= 0) return null;
  return {
    qty,
    productName: m[2].trim(),
    deliveryStatus: m[3].toUpperCase() as "ORDERED" | "DELIVERED",
    orderRef: m[4]?.trim() ?? null,
  };
}

/** Normalises a product name so the same product from different invoices groups together. */
export function productKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/[®™]/g, "")
    .replace(/\s+/g, " ")
    .replace(/[,.]$/, "")
    .trim();
}

/** Net amount implied by a gross amount and VAT rate, rounded to 2dp. */
export const netOf = (amountGross: number, vatRate: number) => Math.round((amountGross / (1 + vatRate / 100)) * 100) / 100;
