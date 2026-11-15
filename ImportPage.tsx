import { useState } from "react";
import { Loader2, Upload } from "lucide-react";
import { Button, Card, Input } from "@/components/ui";
import { useToast } from "@/components/overlay";
import { useAuth } from "@/hooks/useAuth";
import { useAllExpenses } from "@/hooks/useLive";
import { data } from "@/lib/data";
import { fb } from "@/lib/firebase/config";
import { doc, getDoc } from "firebase/firestore";
import { EXPENSE_CATEGORIES, type CategoryId, type NewExpense, type PaymentMethod } from "@/types";

const CAT_IDS = EXPENSE_CATEGORIES.map(c => c.id);
const CAT_LABELS = Object.fromEntries(EXPENSE_CATEGORIES.map(c => [c.label.toLowerCase(), c.id]));

function parseCategory(s: string): CategoryId | null {
  const t = s.trim().toLowerCase();
  if (CAT_IDS.includes(t as CategoryId)) return t as CategoryId;
  return (CAT_LABELS[t] as CategoryId) ?? null;
}

function parseVat(s: string): number | null {
  const n = parseFloat(s.replace("%", "").trim());
  if ([0, 7, 19].includes(n)) return n;
  return null;
}

function parsePayment(s: string): PaymentMethod | null {
  const t = s.trim().toLowerCase();
  const map: Record<string, PaymentMethod> = { card: "card", cash: "cash", bank: "bank", invoice: "invoice", rechnung: "invoice" };
  return map[t] ?? null;
}

function parseDate(s: string): string | null {
  const t = s.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  // try DD.MM.YYYY
  const m = t.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return null;
}

interface ParsedRow {
  line: number;
  raw: string;
  date?: string;
  supplier?: string;
  category?: CategoryId;
  subcategory?: string;
  vatRate?: number;
  amount?: number;
  paymentMethod?: PaymentMethod;
  invoiceNo?: string;
  note?: string;
  errors: string[];
  status: "valid" | "invalid" | "duplicate" | "locked";
  skipReason?: string;
}

export function ImportPage() {
  const { cityId } = useAuth();
  const toast = useToast();
  const everything = useAllExpenses();
  const [text, setText] = useState("");
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [checked, setChecked] = useState(false);
  const [importing, setImporting] = useState(false);

  const check = async () => {
    if (!cityId) return;
    const lines = text.split("\n").map(l => l.trim()).filter(l => l && !l.startsWith("#"));
    // Check which months are locked
    const months = new Set<string>();
    lines.forEach(line => {
      const parts = line.split("|").map(p => p.trim());
      const d = parseDate(parts[0] ?? "");
      if (d) months.add(d.slice(0, 7));
    });
    const lockedMonths = new Set<string>();
    await Promise.all([...months].map(async m => {
      const snap = await getDoc(doc(fb().db, `cities/${cityId}/locks/${m}`));
      if (snap.exists()) lockedMonths.add(m);
    }));

    const parsed: ParsedRow[] = lines.map((raw, i) => {
      const parts = raw.split("|").map(p => p.trim());
      const errors: string[] = [];
      const row: ParsedRow = { line: i + 1, raw, errors, status: "invalid" };

      row.date = parseDate(parts[0] ?? "") ?? undefined;
      if (!row.date) errors.push("Invalid date");

      row.supplier = parts[1]?.trim() || undefined;
      if (!row.supplier) errors.push("Missing supplier");

      row.category = parseCategory(parts[2] ?? "") ?? undefined;
      if (!row.category) errors.push(`Unknown category "${parts[2] ?? ""}"`);

      row.subcategory = parts[3]?.trim() || (row.category ? EXPENSE_CATEGORIES.find(c => c.id === row.category)!.subs[0] : undefined);

      const vatParsed = parseVat(parts[4] ?? "");
      row.vatRate = vatParsed ?? undefined;
      if (vatParsed === null) errors.push(`Invalid VAT "${parts[4] ?? ""}"`);

      const amtRaw = (parts[5] ?? "").replace(/[€\s]/g, "").replace(",", ".");
      const amt = parseFloat(amtRaw);
      row.amount = Number.isFinite(amt) && amt > 0 ? Math.round(amt * 100) / 100 : undefined;
      if (!row.amount) errors.push(`Invalid amount "${parts[5] ?? ""}"`);

      row.paymentMethod = parsePayment(parts[6] ?? "") ?? undefined;
      if (!row.paymentMethod) errors.push(`Invalid payment method "${parts[6] ?? ""}"`);

      row.invoiceNo = parts[7]?.trim() || undefined;
      row.note = parts[8]?.trim() || "";

      if (errors.length === 0) {
        // Check month lock
        if (row.date && lockedMonths.has(row.date.slice(0, 7))) {
          row.status = "locked";
          row.skipReason = `Month ${row.date.slice(0, 7)} is locked`;
        } else {
          // Check duplicates against existing
          const existing = everything ?? [];
          const inv = row.invoiceNo;
          const sup = row.supplier!.toLowerCase();
          if (inv) {
            const dupe = existing.find(e => e.supplier.trim().toLowerCase() === sup && e.invoiceNo === inv);
            if (dupe) { row.status = "duplicate"; row.skipReason = `Invoice ${inv} already exists (${dupe.date})`; }
            else row.status = "valid";
          } else {
            const dupe = existing.find(e => e.supplier.trim().toLowerCase() === sup && e.date === row.date && e.amount === row.amount);
            if (dupe) { row.status = "duplicate"; row.skipReason = `Same supplier/date/amount already exists`; }
            else row.status = "valid";
          }
        }
      }
      return row;
    });

    setRows(parsed);
    setChecked(true);
  };

  const doImport = async () => {
    if (!cityId) return;
    const toImport = rows.filter(r => r.status === "valid");
    if (toImport.length === 0) return toast("Nothing to import");
    setImporting(true);
    let ok = 0;
    for (const r of toImport) {
      const e: NewExpense = {
        cityId,
        date: r.date!,
        amount: r.amount!,
        vatRate: r.vatRate!,
        category: r.category!,
        subcategory: r.subcategory!,
        supplier: r.supplier!,
        paymentMethod: r.paymentMethod!,
        receiptUrl: null,
        enteredBy: "import",
        enteredByName: "JARVIS import",
        status: "pending",
        note: r.note ?? "",
        vehicleId: null,
        invoiceNo: r.invoiceNo,
      };
      await data.addExpense(cityId, e);
      ok++;
    }
    setImporting(false);
    toast(`Imported ${ok} expense${ok === 1 ? "" : "s"}`);
    setText("");
    setRows([]);
    setChecked(false);
  };

  const validCount = rows.filter(r => r.status === "valid").length;
  const skipCount = rows.filter(r => r.status !== "valid").length;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <h1 className="text-xl font-semibold">Import expenses</h1>
      <Card className="p-4 space-y-3">
        <p className="text-sm text-muted">
          Paste pipe-delimited rows — one per line:<br />
          <code className="text-xs bg-slate-100 dark:bg-slate-800 px-1 rounded">
            date | supplier | category | type | VAT% | gross EUR | paid by | invoice no. | note
          </code>
        </p>
        <p className="text-xs text-muted">
          Categories: {EXPENSE_CATEGORIES.map(c => c.id).join(", ")}.<br />
          VAT: 19, 7, or 0. Paid by: card, cash, bank, invoice.
        </p>
        <textarea
          className="w-full rounded-lg border border-line bg-surface p-3 font-mono text-xs outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
          rows={8}
          placeholder={"2026-11-01 | METRO Essen | nonfood | Packaging | 19 | 150.00 | card | INV-001 | Office supplies\n2026-11-02 | Shell | fuel | Diesel | 19 | 80.50 | card | | Van fill-up"}
          value={text}
          onChange={e => { setText(e.target.value); setChecked(false); setRows([]); }}
        />
        <div className="flex gap-2">
          <Button variant="outline" onClick={check} disabled={!text.trim()}>
            Check
          </Button>
          {checked && validCount > 0 && (
            <Button variant="brand" onClick={doImport} disabled={importing}>
              {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              Import {validCount} row{validCount === 1 ? "" : "s"}
            </Button>
          )}
        </div>
      </Card>

      {rows.length > 0 && (
        <Card className="overflow-hidden">
          <div className="border-b border-line px-4 py-3 text-sm font-semibold">
            Preview — {validCount} valid, {skipCount} skipped
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-xs">
              <thead className="bg-slate-50 text-left text-muted">
                <tr>
                  <th className="px-3 py-2">#</th>
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Supplier</th>
                  <th className="px-3 py-2">Category</th>
                  <th className="px-3 py-2 text-right">Amount</th>
                  <th className="px-3 py-2">Invoice no.</th>
                  <th className="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map(r => (
                  <tr key={r.line} className={r.status === "valid" ? "" : "bg-red-50/50 dark:bg-red-900/10"}>
                    <td className="px-3 py-2 text-muted">{r.line}</td>
                    <td className="px-3 py-2">{r.date ?? <span className="text-bad">–</span>}</td>
                    <td className="px-3 py-2">{r.supplier ?? <span className="text-bad">–</span>}</td>
                    <td className="px-3 py-2">{r.category ?? <span className="text-bad">–</span>}</td>
                    <td className="px-3 py-2 text-right tabular">{r.amount ? `€ ${r.amount.toFixed(2)}` : <span className="text-bad">–</span>}</td>
                    <td className="px-3 py-2">{r.invoiceNo ?? ""}</td>
                    <td className="px-3 py-2">
                      {r.status === "valid" && <span className="text-good">✓ Import</span>}
                      {r.status === "invalid" && <span className="text-bad">{r.errors.join("; ")}</span>}
                      {r.status === "duplicate" && <span className="text-warn">Skip: {r.skipReason}</span>}
                      {r.status === "locked" && <span className="text-warn">Skip: {r.skipReason}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
