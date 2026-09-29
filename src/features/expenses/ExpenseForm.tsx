import { useMemo, useRef, useState } from "react";
import { Camera, FileText, Loader2, X } from "lucide-react";
import { Button, Input } from "@/components/ui";
import { Field, Segmented } from "@/components/overlay";
import { useAuth } from "@/hooks/useAuth";
import { useConfig } from "@/hooks/useLive";
import { data } from "@/lib/data";
import { cn, fmtEur, todayIso } from "@/lib/format";
import { compressReceipt } from "@/lib/image";
import { EXPENSE_CATEGORIES, type CategoryId, type Expense, type NewExpense, type PaymentMethod } from "@/types";

export const VEHICLES = [
  { id: "van1", label: "Van 1" },
  { id: "van2", label: "Van 2" },
];
export const vehicleLabel = (id?: string | null) => VEHICLES.find((v) => v.id === id)?.label ?? "";
export const catLabel = (id: string) => EXPENSE_CATEGORIES.find((c) => c.id === id)?.label ?? id;

const PAYMENT: { value: PaymentMethod; label: string }[] = [
  { value: "card", label: "Card" },
  { value: "cash", label: "Cash" },
  { value: "bank", label: "Bank" },
  { value: "invoice", label: "Invoice" },
];

/** German VAT defaults: food 7 %, rent/insurance/payroll 0 %, everything else 19 %. */
export function defaultVat(category: CategoryId, sub: string) {
  if (category === "tempfood") return 7;
  if (category === "employees") return 0;
  if (["Rent", "Insurance", "Licences"].includes(sub)) return 0;
  return 19;
}

/** Accepts "62,40", "62.40", "1.234,50", "€ 62". */
export function parseAmount(s: string): number {
  let t = s.replace(/[€\s]/g, "");
  if (t.includes(",")) t = t.replace(/\./g, "").replace(",", ".");
  const n = Number(t);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : NaN;
}

export interface ExpenseFormProps {
  initial?: Expense;
  suppliers: string[];
  submitLabel: string;
  onSubmit: (e: NewExpense) => Promise<void>;
  compact?: boolean;
}

export function ExpenseForm({ initial, suppliers, submitLabel, onSubmit }: ExpenseFormProps) {
  const { user, cityId, role } = useAuth();
  const { approvalLimit } = useConfig();
  const [amount, setAmount] = useState(initial ? String(initial.amount).replace(".", ",") : "");
  const [category, setCategory] = useState<CategoryId | null>(initial?.category ?? null);
  const [sub, setSub] = useState(initial?.subcategory ?? "");
  const [supplier, setSupplier] = useState(initial?.supplier ?? "");
  const [date, setDate] = useState(initial?.date ?? todayIso());
  const [pm, setPm] = useState<PaymentMethod>(initial?.paymentMethod ?? "card");
  const [vat, setVat] = useState(initial?.vatRate ?? 19);
  const [vehicle, setVehicle] = useState(initial?.vehicleId ?? "");
  const [note, setNote] = useState(initial?.note ?? "");
  const [receipt, setReceipt] = useState<string | null>(initial?.receiptUrl ?? null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const subs = useMemo(() => EXPENSE_CATEGORIES.find((c) => c.id === category)?.subs ?? [], [category]);
  const value = parseAmount(amount);
  const needsVehicle = category === "fuel" || category === "logistics";
  const overLimit = role === "staff" && value > approvalLimit;
  const yesterday = (() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  })();

  const pickCategory = (c: CategoryId) => {
    setCategory(c);
    const first = EXPENSE_CATEGORIES.find((x) => x.id === c)!.subs[0];
    setSub(first);
    setVat(defaultVat(c, first));
  };
  const pickSub = (s: string) => {
    setSub(s);
    if (category) setVat(defaultVat(category, s));
  };

  const onFile = async (f: File | undefined) => {
    if (!f || !cityId || !user) return;
    setUploading(true);
    setErr(null);
    try {
      const blob = await compressReceipt(f);
      setReceipt(await data.uploadReceipt(cityId, user.uid, blob, f.name.replace(/[^\w.-]/g, "_")));
    } catch (e) {
      setErr(`Receipt upload failed: ${(e as Error).message}`);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const submit = async () => {
    setErr(null);
    if (!Number.isFinite(value) || value <= 0) return setErr("Enter an amount.");
    if (!category) return setErr("Pick a category.");
    if (!supplier.trim()) return setErr("Enter the supplier.");
    if (needsVehicle && category === "fuel" && !vehicle) return setErr("Pick the vehicle.");
    if (!user || !cityId) return;
    setSaving(true);
    try {
      await onSubmit({
        cityId, date, amount: value, vatRate: vat, category, subcategory: sub, supplier: supplier.trim(), paymentMethod: pm,
        receiptUrl: receipt, enteredBy: initial?.enteredBy ?? user.uid, enteredByName: initial?.enteredByName ?? user.name,
        status: initial?.status ?? (overLimit ? "pending" : "approved"), note: note.trim(), vehicleId: needsVehicle ? vehicle || null : null,
      });
      if (!initial) {
        setAmount(""); setCategory(null); setSub(""); setSupplier(""); setVehicle(""); setNote(""); setReceipt(null);
      }
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <Field label="Amount (gross, EUR)">
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xl text-muted">€</span>
          <input
            inputMode="decimal"
            autoFocus={!initial}
            placeholder="0,00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            aria-label="Amount"
            className="tabular h-14 w-full rounded-xl border border-line bg-surface pl-9 pr-3 text-2xl font-semibold outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
          />
        </div>
      </Field>

      <Field group label="Category">
        <div className="flex flex-wrap gap-1.5">
          {EXPENSE_CATEGORIES.map((c) => (
            <Chip key={c.id} active={category === c.id} onClick={() => pickCategory(c.id)}>{c.label}</Chip>
          ))}
        </div>
      </Field>

      {category && (
        <Field group label="Type">
          <div className="flex flex-wrap gap-1.5">
            {subs.map((s) => <Chip key={s} small active={sub === s} onClick={() => pickSub(s)}>{s}</Chip>)}
          </div>
        </Field>
      )}

      {needsVehicle && (
        <Field group label="Vehicle">
          <div className="flex flex-wrap gap-1.5">
            {VEHICLES.map((v) => <Chip key={v.id} small active={vehicle === v.id} onClick={() => setVehicle(vehicle === v.id ? "" : v.id)}>{v.label}</Chip>)}
          </div>
        </Field>
      )}

      <Field label="Supplier">
        <Input list="supplier-list" placeholder="e.g. METRO Essen" value={supplier} onChange={(e) => setSupplier(e.target.value)} aria-label="Supplier" />
        <datalist id="supplier-list">{suppliers.map((s) => <option key={s} value={s} />)}</datalist>
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field group label="Date">
          <Input type="date" value={date} max={todayIso()} onChange={(e) => setDate(e.target.value)} aria-label="Date" />
          <div className="mt-1 flex gap-1 text-[11px]">
            <button type="button" className={cn("rounded px-1.5 py-0.5 hover:bg-slate-100", date === todayIso() && "bg-slate-100 font-medium")} onClick={() => setDate(todayIso())}>Today</button>
            <button type="button" className={cn("rounded px-1.5 py-0.5 hover:bg-slate-100", date === yesterday && "bg-slate-100 font-medium")} onClick={() => setDate(yesterday)}>Yesterday</button>
          </div>
        </Field>
        <Field group label="VAT">
          <Segmented label="VAT" value={vat} onChange={setVat} className="w-full" options={[{ value: 19, label: "19 %" }, { value: 7, label: "7 %" }, { value: 0, label: "0 %" }]} />
          {Number.isFinite(value) && value > 0 && vat > 0 && (
            <span className="tabular mt-1 block text-[11px] text-muted">net {fmtEur(value / (1 + vat / 100))} · VAT {fmtEur(value - value / (1 + vat / 100))}</span>
          )}
        </Field>
      </div>

      <Field group label="Paid by">
        <Segmented label="Payment method" value={pm} onChange={setPm} options={PAYMENT} className="w-full" />
      </Field>

      <Field group label="Receipt">
        <input ref={fileRef} type="file" accept="image/*,application/pdf" capture="environment" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} aria-label="Receipt file" />
        {receipt ? (
          <div className="flex items-center gap-3 rounded-lg border border-line p-2">
            {receipt.startsWith("blob:") || receipt.startsWith("http") ? (
              <img src={receipt} alt="Receipt" className="h-14 w-14 rounded object-cover" onError={(e) => ((e.target as HTMLImageElement).style.display = "none")} />
            ) : (
              <FileText className="h-8 w-8 text-muted" />
            )}
            <span className="flex-1 text-sm text-good">Receipt attached</span>
            <Button type="button" size="sm" variant="ghost" onClick={() => setReceipt(null)} aria-label="Remove receipt"><X className="h-4 w-4" /></Button>
          </div>
        ) : (
          <Button type="button" variant="outline" className="h-12 w-full" disabled={uploading} onClick={() => fileRef.current?.click()}>
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
            {uploading ? "Uploading…" : "Photo of receipt"}
          </Button>
        )}
      </Field>

      <Field label="Note (optional)">
        <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="What was it for?" aria-label="Note" />
      </Field>

      {overLimit && <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">Above {fmtEur(approvalLimit, true)} – will wait for the City Manager's approval.</p>}
      {err && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700" role="alert">{err}</p>}

      <Button type="submit" variant="brand" className="h-12 w-full text-base" disabled={saving || uploading}>
        {saving && <Loader2 className="h-4 w-4 animate-spin" />} {submitLabel}
      </Button>
    </form>
  );
}

function Chip({ active, onClick, children, small }: { active: boolean; onClick: () => void; children: React.ReactNode; small?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "rounded-lg border px-3 text-sm transition-colors",
        small ? "py-1 text-xs" : "py-1.5",
        active ? "border-brand bg-brand text-white" : "border-line bg-surface hover:border-slate-300",
      )}
    >
      {children}
    </button>
  );
}
