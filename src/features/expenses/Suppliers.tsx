import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { TrendingDown, TrendingUp } from "lucide-react";
import { Card } from "@/components/ui";
import { Segmented } from "@/components/overlay";
import { useExpenses } from "@/hooks/useLive";
import { cn, currentMonth, fmtDate, fmtEur } from "@/lib/format";
import { lastMonths, monthRange } from "@/lib/kpi";
import { catLabel } from "./ExpenseForm";

interface Row {
  supplier: string;
  total: number;
  count: number;
  last: string;
  categories: Set<string>;
  thisMonth: number;
  prevMonth: number;
}

export function Suppliers() {
  const [span, setSpan] = useState<1 | 3 | 6>(3);
  const months = useMemo(() => lastMonths(currentMonth(), span), [span]);
  const all = useExpenses(monthRange(months[0]).from, monthRange(months[months.length - 1]).to);
  const nav = useNavigate();
  const cur = currentMonth();
  const prev = lastMonths(cur, 2)[0];

  const rows = useMemo(() => {
    const m = new Map<string, Row>();
    for (const e of all ?? []) {
      const r = m.get(e.supplier) ?? { supplier: e.supplier, total: 0, count: 0, last: "", categories: new Set(), thisMonth: 0, prevMonth: 0 };
      r.total += e.amount;
      r.count += 1;
      r.categories.add(catLabel(e.category));
      if (e.date > r.last) r.last = e.date;
      if (e.date.startsWith(cur)) r.thisMonth += e.amount;
      if (e.date.startsWith(prev)) r.prevMonth += e.amount;
      m.set(e.supplier, r);
    }
    return [...m.values()].sort((a, b) => b.total - a.total);
  }, [all, cur, prev]);
  const grand = rows.reduce((s, r) => s + r.total, 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="mr-auto text-xl font-semibold">Suppliers</h1>
        <Segmented label="Period" value={span} onChange={setSpan} options={[{ value: 1, label: "This month" }, { value: 3, label: "3 months" }, { value: 6, label: "6 months" }]} />
      </div>
      <Card className="overflow-hidden">
        {all === null ? (
          <div className="p-6 text-sm text-muted">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted">No purchases in this period.</div>
        ) : (
          <ul className="divide-y divide-line">
            {rows.map((r) => {
              const delta = r.prevMonth > 0 ? (r.thisMonth - r.prevMonth) / r.prevMonth : null;
              return (
                <li key={r.supplier}>
                  <button onClick={() => nav(`/expenses?q=${encodeURIComponent(r.supplier)}`)} className="flex w-full items-center gap-4 px-4 py-3 text-left hover:bg-slate-50">
                    <div className="min-w-0 flex-1">
                      <div className="font-medium">{r.supplier}</div>
                      <div className="truncate text-xs text-muted">{[...r.categories].join(", ")} · {r.count} bills · last {fmtDate(r.last)}</div>
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
                        <div className="h-full rounded-full bg-brand" style={{ width: `${(r.total / rows[0].total) * 100}%` }} />
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="tabular font-semibold">{fmtEur(r.total, true)}</div>
                      <div className="tabular text-[11px] text-muted">{((r.total / grand) * 100).toFixed(1)} %</div>
                      {span > 1 && delta !== null && Math.abs(delta) >= 0.1 && (
                        <div className={cn("inline-flex items-center gap-0.5 text-[11px]", delta > 0 ? "text-bad" : "text-good")} title="This month vs last month">
                          {delta > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                          {Math.round(delta * 100)} %
                        </div>
                      )}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
