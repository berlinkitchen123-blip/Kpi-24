import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Badge, Card } from "@/components/ui";
import { Segmented } from "@/components/overlay";
import { useExpenses } from "@/hooks/useLive";
import { cn, currentMonth, fmtDate, fmtEur } from "@/lib/format";
import { netOf, parseExpenseNote, productKey } from "@/lib/expenseNotes";
import { lastMonths, monthLabel, monthRange } from "@/lib/kpi";
import type { Expense } from "@/types";

const SERIES_COLORS = ["#0f766e", "#d97706", "#0369a1", "#be185d", "#4d7c0f", "#7c3aed", "#b91c1c", "#0891b2", "#78716c"];

export function SupplierInsights() {
  const [span, setSpan] = useState<1 | 3 | 6>(3);
  const months = useMemo(() => lastMonths(currentMonth(), span), [span]);
  const all = useExpenses(monthRange(months[0]).from, monthRange(months[months.length - 1]).to);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="mr-auto text-xl font-semibold">Supplier insights</h1>
        <Segmented label="Period" value={span} onChange={setSpan} options={[{ value: 1, label: "This month" }, { value: 3, label: "3 months" }, { value: 6, label: "6 months" }]} />
      </div>
      {all === null ? (
        <Card className="p-6 text-sm text-muted">Loading…</Card>
      ) : (
        <>
          <SpendPerSupplier all={all} months={months} />
          <PriceComparison all={all} />
        </>
      )}
    </div>
  );
}

// ---- 5a: spend per supplier per month --------------------------------------------------------
function SpendPerSupplier({ all, months }: { all: Expense[]; months: string[] }) {
  const rows = useMemo(() => {
    const m = new Map<string, { lines: number; net: number; gross: number }>();
    for (const e of all) {
      const r = m.get(e.supplier) ?? { lines: 0, net: 0, gross: 0 };
      r.lines += 1;
      r.net += netOf(e.amount, e.vatRate);
      r.gross += e.amount;
      m.set(e.supplier, r);
    }
    return [...m.entries()].map(([supplier, r]) => ({ supplier, ...r })).sort((a, b) => b.gross - a.gross);
  }, [all]);
  const totalGross = rows.reduce((s, r) => s + r.gross, 0);
  const top = rows.slice(0, 8);
  const topNames = top.map((r) => r.supplier);

  const chartData = useMemo(() => {
    return months.map((m) => {
      const bySupplier = new Map<string, number>();
      let other = 0;
      for (const e of all) {
        if (!e.date.startsWith(m)) continue;
        if (topNames.includes(e.supplier)) bySupplier.set(e.supplier, (bySupplier.get(e.supplier) ?? 0) + e.amount);
        else other += e.amount;
      }
      const point: Record<string, number | string> = { label: monthLabel(m, "short") };
      topNames.forEach((s) => (point[s] = bySupplier.get(s) ?? 0));
      point["Other"] = other;
      return point;
    });
  }, [all, months, topNames]);

  return (
    <Card className="p-4">
      <h2 className="mb-3 text-sm font-semibold">Spend per supplier</h2>
      {rows.length === 0 ? (
        <p className="text-sm text-muted">No purchases in this period.</p>
      ) : (
        <>
          <div className="overflow-hidden rounded-lg border border-line">
            <table className="w-full text-sm">
              <thead className="border-b border-line bg-slate-50 text-left text-xs text-muted">
                <tr>
                  <th className="px-3 py-2 font-medium">Supplier</th>
                  <th className="px-2 py-2 text-right font-medium">Lines</th>
                  <th className="px-2 py-2 text-right font-medium">Netto</th>
                  <th className="px-2 py-2 text-right font-medium">Brutto</th>
                  <th className="px-3 py-2 text-right font-medium">% of spend</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((r) => {
                  const pct = totalGross ? (r.gross / totalGross) * 100 : 0;
                  return (
                    <tr key={r.supplier}>
                      <td className="px-3 py-2 font-medium">{r.supplier}</td>
                      <td className="tabular px-2 py-2 text-right text-muted">{r.lines}</td>
                      <td className="tabular px-2 py-2 text-right text-muted">{fmtEur(r.net)}</td>
                      <td className="tabular px-2 py-2 text-right font-medium">{fmtEur(r.gross)}</td>
                      <td className="relative px-3 py-2 text-right">
                        <div className="absolute inset-y-1 left-0 rounded bg-brand-soft/60" style={{ width: `${pct}%` }} />
                        <span className="tabular relative">{pct.toFixed(1)} %</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                <CartesianGrid stroke="#eef2f6" vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#64748b" }} />
                <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#64748b" }} tickFormatter={(v: number) => fmtEur(v, true)} width={56} />
                <Tooltip formatter={(v) => fmtEur(Number(v))} contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e2e8f0" }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {[...topNames, "Other"].map((s, i) => (
                  <Bar key={s} dataKey={s} stackId="spend" fill={s === "Other" ? "#cbd5e1" : SERIES_COLORS[i % SERIES_COLORS.length]} isAnimationActive={false} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </Card>
  );
}

// ---- 5b/5c: price comparison + history per product -------------------------------------------
interface PriceLine {
  supplier: string;
  date: string;
  qty: number;
  netUnit: number;
  netTotal: number;
}
interface ProductGroup {
  key: string;
  name: string;
  lines: PriceLine[];
}

function PriceComparison({ all }: { all: Expense[] }) {
  const { groups, unparsedCount } = useMemo(() => {
    const byKey = new Map<string, { names: Map<string, number>; lines: PriceLine[] }>();
    const emptyGroup = () => ({ names: new Map<string, number>(), lines: [] as PriceLine[] });
    let unparsed = 0;
    for (const e of all) {
      const parsed = parseExpenseNote(e.note);
      if (!parsed) {
        if (e.note) unparsed += 1; // had a note but didn't match the structured format
        continue;
      }
      const key = productKey(parsed.productName);
      const net = netOf(e.amount, e.vatRate);
      const g = byKey.get(key) ?? emptyGroup();
      g.names.set(parsed.productName, (g.names.get(parsed.productName) ?? 0) + 1);
      g.lines.push({ supplier: e.supplier, date: e.date, qty: parsed.qty, netUnit: Math.round((net / parsed.qty) * 100) / 100, netTotal: net });
      byKey.set(key, g);
    }
    const groups: ProductGroup[] = [...byKey.entries()]
      .map(([key, g]) => ({
        key,
        name: [...g.names.entries()].sort((a, b) => b[0].length - a[0].length)[0][0],
        lines: g.lines.sort((a, b) => a.netUnit - b.netUnit),
      }))
      .filter((g) => g.lines.length >= 2 && (new Set(g.lines.map((l) => l.supplier)).size >= 2 || g.lines.length >= 2));
    groups.sort((a, b) => savingPotential(b) - savingPotential(a));
    return { groups, unparsedCount: unparsed };
  }, [all]);

  const [showUnparsed, setShowUnparsed] = useState(false);

  return (
    <div className="space-y-4">
      <h2 className="text-sm font-semibold">Price comparison per product</h2>
      {groups.length === 0 ? (
        <Card className="p-6 text-sm text-muted">No product bought from 2+ suppliers (or 2+ times) with a parseable note was found in this period.</Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {groups.map((g) => <ProductCard key={g.key} group={g} />)}
        </div>
      )}
      {unparsedCount > 0 && (
        <Card className="p-3 text-xs text-muted">
          <button className="underline" onClick={() => setShowUnparsed((s) => !s)}>{unparsedCount} lines could not be parsed into product/qty {showUnparsed ? "▲" : "▼"}</button>
          {showUnparsed && (
            <p className="mt-2">
              These notes don't match the "Netto … / Brutto … – NxProduct – ORDERED/DELIVERED" format, so qty and product can't be
              extracted. <Link to="/expenses" className="text-brand underline">Open the expense list</Link> to review them.
            </p>
          )}
        </Card>
      )}
    </div>
  );
}

function savingPotential(g: ProductGroup) {
  const prices = g.lines.map((l) => l.netUnit);
  const totalQty = g.lines.reduce((s, l) => s + l.qty, 0);
  return (Math.max(...prices) - Math.min(...prices)) * totalQty;
}

function ProductCard({ group }: { group: ProductGroup }) {
  const cheapest = group.lines[0];
  const priciest = group.lines[group.lines.length - 1];
  const delta = priciest.netUnit > 0 ? ((cheapest.netUnit - priciest.netUnit) / priciest.netUnit) * 100 : 0;
  const hasHistory = group.lines.length > 1;
  const spark = [...group.lines].sort((a, b) => a.date.localeCompare(b.date));

  return (
    <Card className="p-4">
      <div className="mb-1 flex items-start justify-between gap-2">
        <h3 className="text-sm font-semibold">{group.name}</h3>
        {savingPotential(group) > 0.01 && <Badge tone="brand">save {fmtEur(savingPotential(group))}</Badge>}
      </div>
      <p className="mb-3 text-xs text-muted">
        Cheapest: <span className="font-medium text-ink">{cheapest.supplier}</span> at <span className="tabular font-medium text-ink">{fmtEur(cheapest.netUnit)}</span> / unit
        {priciest !== cheapest && <> · <span className="text-good">{delta.toFixed(1)} %</span> vs most expensive</>}
      </p>
      <div className="overflow-hidden rounded-lg border border-line">
        <table className="w-full text-xs">
          <thead className="border-b border-line bg-slate-50 text-left text-muted">
            <tr>
              <th className="px-2 py-1.5 font-medium">Supplier</th>
              <th className="px-2 py-1.5 font-medium">Date</th>
              <th className="px-2 py-1.5 text-right font-medium">Qty</th>
              <th className="px-2 py-1.5 text-right font-medium">Net/unit</th>
              <th className="px-2 py-1.5 text-right font-medium">Net total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {group.lines.map((l, i) => (
              <tr key={i} className={cn(l === cheapest && "bg-brand-soft/30")}>
                <td className="px-2 py-1.5">
                  {l.supplier} {l === cheapest && <Badge tone="brand" className="ml-1">best</Badge>}
                </td>
                <td className="tabular px-2 py-1.5 text-muted">{fmtDate(l.date)}</td>
                <td className="tabular px-2 py-1.5 text-right">{l.qty}</td>
                <td className="tabular px-2 py-1.5 text-right font-medium">{fmtEur(l.netUnit)}</td>
                <td className="tabular px-2 py-1.5 text-right text-muted">{fmtEur(l.netTotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {hasHistory && (
        <div className="mt-3 h-24">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={spark.map((l) => ({ label: `${fmtDate(l.date)} · ${l.supplier}`, v: l.netUnit }))} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
              <XAxis dataKey="label" hide />
              <YAxis hide domain={["auto", "auto"]} />
              <Tooltip formatter={(v) => fmtEur(Number(v))} contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid #e2e8f0" }} />
              <Line type="monotone" dataKey="v" stroke="#0f766e" strokeWidth={2} isAnimationActive={false} dot={{ r: 2.5, fill: "#0f766e" }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}
