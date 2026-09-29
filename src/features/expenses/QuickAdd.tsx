import { useMemo } from "react";
import { Card } from "@/components/ui";
import { useToast } from "@/components/overlay";
import { useAuth } from "@/hooks/useAuth";
import { useExpenses } from "@/hooks/useLive";
import { data } from "@/lib/data";
import { fmtDate, fmtEur, todayIso } from "@/lib/format";
import { catLabel, ExpenseForm, vehicleLabel } from "./ExpenseForm";

/** One line, as in the brief: "Saved: EUR 62.40, Fuel, Van 2, 24 Sep" */
export const savedLine = (e: { amount: number; category: string; vehicleId?: string | null; date: string; status?: string }) =>
  `Saved: EUR ${e.amount.toFixed(2)}, ${catLabel(e.category)}${e.vehicleId ? `, ${vehicleLabel(e.vehicleId)}` : ""}, ${fmtDate(e.date)}${e.status === "pending" ? " (awaiting approval)" : ""}`;

export function QuickAdd() {
  const { cityId } = useAuth();
  const toast = useToast();
  const from = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 90);
    return d.toISOString().slice(0, 10);
  }, []);
  const recent = useExpenses(from, todayIso());
  const suppliers = useMemo(() => {
    const count = new Map<string, number>();
    (recent ?? []).forEach((e) => count.set(e.supplier, (count.get(e.supplier) ?? 0) + 1));
    return [...count.entries()].sort((a, b) => b[1] - a[1]).map(([s]) => s);
  }, [recent]);
  const today = (recent ?? []).filter((e) => e.date === todayIso());

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <h1 className="text-xl font-semibold">Quick Add</h1>
      <Card className="p-4 sm:p-5">
        <ExpenseForm
          suppliers={suppliers}
          submitLabel="Save expense"
          onSubmit={async (e) => {
            const id = await data.addExpense(cityId!, e);
            toast(savedLine(e), { label: "Undo", run: () => data.deleteExpense(cityId!, id) });
          }}
        />
      </Card>
      {today.length > 0 && (
        <Card className="p-4">
          <h2 className="mb-2 text-sm font-semibold">Added today</h2>
          <ul className="divide-y divide-line text-sm">
            {today.map((e) => (
              <li key={e.id} className="flex justify-between py-1.5">
                <span className="truncate">{e.supplier} · {catLabel(e.category)}</span>
                <span className="tabular font-medium">{fmtEur(e.amount)}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
