import { useState } from "react";
import { Card } from "@/components/ui";
import { MonthPicker } from "@/components/MonthPicker";
import { useAuth } from "@/hooks/useAuth";
import { useExpenses } from "@/hooks/useLive";
import { EXPENSE_CATEGORIES } from "@/types";
import { monthRange } from "@/lib/kpi";
import { fmtEur, fmtDate, currentMonth } from "@/lib/format";
import { catLabel } from "@/features/expenses/ExpenseForm";

function netOf(gross: number, vatRate: number) {
  return gross / (1 + vatRate / 100);
}

export function MonthTextPage() {
  const [month, setMonth] = useState(currentMonth());
  const { from, to } = monthRange(month);
  const expenses = useExpenses(from, to);

  if (!expenses) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="mr-auto text-xl font-semibold">Month text</h1>
          <MonthPicker value={month} onChange={setMonth} />
        </div>
        <Card className="h-40 animate-pulse" />
      </div>
    );
  }

  const approved = expenses.filter(e => e.status === "approved");
  const pending = expenses.filter(e => e.status !== "approved");
  const sorted = [...approved].sort((a, b) => a.date.localeCompare(b.date) || a.supplier.localeCompare(b.supplier));

  const totalGross = approved.reduce((s, e) => s + e.amount, 0);
  const totalNet = approved.reduce((s, e) => s + netOf(e.amount, e.vatRate), 0);
  const totalVat = totalGross - totalNet;
  const pendingTotal = pending.reduce((s, e) => s + e.amount, 0);

  const byCat = EXPENSE_CATEGORIES.map(c => {
    const cat = approved.filter(e => e.category === c.id);
    return { id: c.id, label: c.label, gross: cat.reduce((s, e) => s + e.amount, 0) };
  }).filter(c => c.gross > 0);

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="mr-auto text-xl font-semibold">Month text</h1>
        <MonthPicker value={month} onChange={setMonth} />
      </div>

      <Card className="p-4 space-y-3">
        <div className="text-sm font-semibold border-b border-line pb-2">
          {month} — approved expenses
        </div>
        <div className="grid grid-cols-3 gap-2 text-sm">
          <div>
            <div className="text-xs text-muted">Net</div>
            <div className="tabular font-semibold">{fmtEur(totalNet)}</div>
          </div>
          <div>
            <div className="text-xs text-muted">VAT</div>
            <div className="tabular font-semibold">{fmtEur(totalVat)}</div>
          </div>
          <div>
            <div className="text-xs text-muted">Gross</div>
            <div className="tabular font-semibold">{fmtEur(totalGross)}</div>
          </div>
        </div>
        {byCat.length > 0 && (
          <div className="border-t border-line pt-2 space-y-1">
            <div className="text-xs text-muted font-medium">By category</div>
            {byCat.map(c => (
              <div key={c.id} className="flex items-center justify-between text-sm">
                <span>{c.label}</span>
                <span className="tabular">{fmtEur(c.gross)}</span>
              </div>
            ))}
          </div>
        )}
        {pendingTotal > 0 && (
          <div className="border-t border-line pt-2 text-sm flex items-center justify-between text-muted">
            <span>Pending (not yet approved)</span>
            <span className="tabular">{fmtEur(pendingTotal)}</span>
          </div>
        )}
      </Card>

      <Card className="overflow-hidden">
        <div className="border-b border-line px-4 py-3 text-sm font-semibold">
          {sorted.length} expense{sorted.length !== 1 ? "s" : ""}
        </div>
        {sorted.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-muted">No approved expenses this month.</div>
        ) : (
          <ul className="divide-y divide-line">
            {sorted.map(e => {
              const net = netOf(e.amount, e.vatRate);
              return (
                <li key={e.id} className="flex items-baseline gap-2 px-4 py-2 text-sm">
                  <span className="w-16 shrink-0 text-xs text-muted tabular">{fmtDate(e.date)}</span>
                  <span className="flex-1 min-w-0 truncate font-medium">{e.supplier}</span>
                  <span className="shrink-0 text-xs text-muted">{catLabel(e.category)}</span>
                  <span className="shrink-0 tabular text-xs text-muted">net {fmtEur(net)}</span>
                  <span className="shrink-0 tabular font-semibold">{fmtEur(e.amount)}</span>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
