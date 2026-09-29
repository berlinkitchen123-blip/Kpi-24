import { useEffect, useMemo, useState } from "react";
import { Copy, Loader2, Save } from "lucide-react";
import { Button, Card, Input } from "@/components/ui";
import { Field, useToast } from "@/components/overlay";
import { MonthPicker } from "@/components/MonthPicker";
import { useAuth, usePermissions } from "@/hooks/useAuth";
import { useBudgets, useExpenses, useRevenue } from "@/hooks/useLive";
import { data } from "@/lib/data";
import { budgetTone, cn, currentMonth, fmtEur } from "@/lib/format";
import { monthRange, shiftMonth } from "@/lib/kpi";
import { parseAmount } from "@/features/expenses/ExpenseForm";
import { EXPENSE_CATEGORIES, type Budget, type CategoryId } from "@/types";

const toStr = (n: number | undefined) => (n ? String(n).replace(".", ",") : "");

export function Budgets() {
  const { cityId } = useAuth();
  const { isManager } = usePermissions();
  const toast = useToast();
  const [month, setMonth] = useState(currentMonth());
  const prev = shiftMonth(month, -1);
  const months = useMemo(() => [prev, month], [prev, month]);
  const budgets = useBudgets(months);
  const revenue = useRevenue([month]);
  const { from, to } = monthRange(month);
  const expenses = useExpenses(from, to);

  const [draft, setDraft] = useState<Record<string, string>>({});
  const [rev, setRev] = useState({ amount: "", dishes: "", planned: "" });
  const [saving, setSaving] = useState<"b" | "r" | null>(null);

  // Load the stored values into the form when the month (or stored data) changes.
  const stored = budgets?.[month];
  useEffect(() => {
    setDraft(Object.fromEntries(EXPENSE_CATEGORIES.map((c) => [c.id, toStr(stored?.[c.id])])));
  }, [month, JSON.stringify(stored)]); // eslint-disable-line react-hooks/exhaustive-deps
  const storedRev = revenue?.[month];
  useEffect(() => {
    setRev({ amount: toStr(storedRev?.amount), dishes: storedRev?.dishesSold ? String(storedRev.dishesSold) : "", planned: toStr(storedRev?.plannedFoodCost) });
  }, [month, JSON.stringify(storedRev)]); // eslint-disable-line react-hooks/exhaustive-deps

  const spent = (id: CategoryId) => (expenses ?? []).filter((e) => e.category === id).reduce((s, e) => s + e.amount, 0);
  const parsed = (s: string) => (s.trim() ? parseAmount(s) : 0);
  const total = EXPENSE_CATEGORIES.reduce((s, c) => s + (parsed(draft[c.id] ?? "") || 0), 0);
  const invalid = EXPENSE_CATEGORIES.some((c) => Number.isNaN(parsed(draft[c.id] ?? "")));
  const dirty = EXPENSE_CATEGORIES.some((c) => (parsed(draft[c.id] ?? "") || 0) !== (stored?.[c.id] ?? 0));

  const saveBudget = async () => {
    const b: Budget = {};
    EXPENSE_CATEGORIES.forEach((c) => {
      const v = parsed(draft[c.id] ?? "");
      if (v > 0) b[c.id] = v;
    });
    setSaving("b");
    await data.setBudget(cityId!, month, b);
    setSaving(null);
    toast(`Budget saved for ${month}`);
  };
  const copyPrev = () => {
    const p = budgets?.[prev];
    if (!p) return toast("No budget in the previous month to copy");
    setDraft(Object.fromEntries(EXPENSE_CATEGORIES.map((c) => [c.id, toStr(p[c.id])])));
  };
  const saveRevenue = async () => {
    const amount = parsed(rev.amount), dishes = Math.round(parsed(rev.dishes)), planned = parsed(rev.planned);
    if ([amount, dishes, planned].some(Number.isNaN)) return toast("Check the numbers");
    setSaving("r");
    await data.setRevenue(cityId!, month, { amount, dishesSold: dishes, plannedFoodCost: planned });
    setSaving(null);
    toast(`Revenue saved for ${month}`);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="mr-auto text-xl font-semibold">Budgets &amp; revenue</h1>
        <MonthPicker value={month} onChange={setMonth} allowFuture />
      </div>

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
          <h2 className="mr-auto text-sm font-semibold">Monthly budget per category</h2>
          {isManager && <Button size="sm" variant="outline" onClick={copyPrev}><Copy className="h-3.5 w-3.5" /> Copy last month</Button>}
          {isManager && (
            <Button size="sm" onClick={saveBudget} disabled={!dirty || invalid || saving === "b"}>
              {saving === "b" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Save budget
            </Button>
          )}
        </div>
        <ul className="divide-y divide-line">
          {EXPENSE_CATEGORIES.map((c) => {
            const s = spent(c.id);
            const b = parsed(draft[c.id] ?? "") || 0;
            const tone = b ? budgetTone(s, b) : null;
            return (
              <li key={c.id} className="flex items-center gap-3 px-4 py-2.5">
                <span className="flex-1 text-sm font-medium">{c.label}</span>
                <span className="tabular hidden w-28 text-right text-xs text-muted sm:block">spent {fmtEur(s, true)}</span>
                <span className={cn("tabular w-12 text-right text-xs font-medium", tone === "red" ? "text-bad" : tone === "amber" ? "text-warn" : "text-good")}>{b ? `${Math.round((s / b) * 100)}%` : ""}</span>
                <div className="relative w-32">
                  <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-muted">€</span>
                  <Input
                    aria-label={`Budget ${c.label}`}
                    inputMode="decimal"
                    disabled={!isManager}
                    value={draft[c.id] ?? ""}
                    onChange={(e) => setDraft((d) => ({ ...d, [c.id]: e.target.value }))}
                    className={cn("tabular pl-6 text-right", Number.isNaN(parsed(draft[c.id] ?? "")) && "border-bad")}
                    placeholder="0"
                  />
                </div>
              </li>
            );
          })}
          <li className="flex items-center gap-3 bg-slate-50 px-4 py-2.5 text-sm font-semibold">
            <span className="flex-1">Total</span>
            <span className="tabular hidden w-28 text-right text-xs sm:block">spent {fmtEur((expenses ?? []).reduce((a, e) => a + e.amount, 0), true)}</span>
            <span className="w-12" />
            <span className="tabular w-32 pr-3 text-right">{fmtEur(total, true)}</span>
          </li>
        </ul>
      </Card>

      <Card className="p-4">
        <div className="mb-3 flex items-center gap-2">
          <h2 className="mr-auto text-sm font-semibold">Revenue &amp; dishes sold</h2>
          {isManager && (
            <Button size="sm" onClick={saveRevenue} disabled={saving === "r"}>
              {saving === "r" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Save revenue
            </Button>
          )}
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Revenue (EUR, net)"><Input aria-label="Revenue" inputMode="decimal" disabled={!isManager} value={rev.amount} onChange={(e) => setRev({ ...rev, amount: e.target.value })} /></Field>
          <Field label="Dishes sold"><Input aria-label="Dishes sold" inputMode="numeric" disabled={!isManager} value={rev.dishes} onChange={(e) => setRev({ ...rev, dishes: e.target.value })} /></Field>
          <Field label="Planned food cost (EUR)" hint="Regular food ordering. Used for temporary food %."><Input aria-label="Planned food cost" inputMode="decimal" disabled={!isManager} value={rev.planned} onChange={(e) => setRev({ ...rev, planned: e.target.value })} /></Field>
        </div>
        <p className="mt-3 text-xs text-muted">Manual monthly entry for now. Later: dishes sold × price or directly from the BB database; planned food cost from the NRW Stock Planner.</p>
      </Card>
    </div>
  );
}
