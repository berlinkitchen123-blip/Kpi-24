import { Link } from "react-router-dom";
import { ArrowDownRight, ArrowUpRight, ChevronRight } from "lucide-react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card } from "@/components/ui";
import { useMonthKpi } from "@/hooks/useLive";
import { budgetTone, cn, currentMonth, fmtEur, fmtPct } from "@/lib/format";
import { catLabel } from "@/features/expenses/ExpenseForm";
import type { KpiSnapshot } from "@/types";

export function KpiOverview({ month = currentMonth() }: { month?: string }) {
  const k = useMonthKpi(month);
  if (k === undefined) return <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <Card key={i} className="h-28 animate-pulse" />)}</div>;
  return <Kpis k={k} />;
}

function Kpis({ k }: { k: KpiSnapshot }) {
  const margin = k.revenue - k.totalSpend;
  const noRevenue = k.dishesSold === 0;
  return (
    <div className="space-y-4">
      {noRevenue && (
        <Card className="border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          Dishes sold and revenue for this month are not entered yet, so per-dish KPIs are empty. <Link to="/budgets" className="font-medium underline">Enter them</Link>
        </Card>
      )}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi to="/kpis" label="Cost per dish" value={noRevenue ? "–" : fmtEur(k.costPerDish)} delta={k.costPerDishPrev != null && !noRevenue ? k.costPerDish - k.costPerDishPrev : undefined} deltaFmt={(d) => fmtEur(Math.abs(d))} lowerIsBetter sub={`${k.dishesSold.toLocaleString("de-DE")} dishes MTD`} primary />
        <Kpi to="/kpis" label="Labour" value={k.labourPct == null ? "–" : fmtPct(k.labourPct)} sub="of revenue" />
        <Kpi to="/kpis" label="Temporary food" value={k.tempFoodPct == null ? "–" : fmtPct(k.tempFoodPct)} delta={k.tempFoodPct != null && k.tempFoodPctPrev != null ? k.tempFoodPct - k.tempFoodPctPrev : undefined} deltaFmt={(d) => `${Math.abs(d).toFixed(1)} pp`} lowerIsBetter sub="of food spend" />
        <Kpi to="/kpis" label="Margin MTD" value={k.revenue ? fmtEur(margin, true) : "–"} sub={k.revenue ? `${fmtPct((margin / k.revenue) * 100)} of ${fmtEur(k.revenue, true)}` : "no revenue yet"} />
      </div>
      <div className="grid gap-4 lg:grid-cols-5">
        <BudgetCard k={k} className="lg:col-span-3" />
        <TrendCard k={k} className="lg:col-span-2" />
      </div>
    </div>
  );
}

export function BudgetCard({ k, className }: { k: KpiSnapshot; className?: string }) {
  const used = k.totalBudget ? k.totalSpend / k.totalBudget : 0;
  const cats = [...k.byCategory].filter((c) => c.budget > 0 || c.spent > 0).sort((a, b) => (b.budget ? b.spent / b.budget : 9) - (a.budget ? a.spent / a.budget : 9));
  return (
    <Card className={cn("p-4", className)}>
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-2">
        <h3 className="text-sm font-semibold">Budget vs actual</h3>
        <span className="tabular text-xs text-muted">
          {fmtEur(k.totalSpend, true)} of {fmtEur(k.totalBudget, true)} · forecast{" "}
          <span className={cn("font-medium", k.totalBudget && k.forecast > k.totalBudget ? "text-bad" : "text-ink")}>{fmtEur(k.forecast, true)}</span>
        </span>
      </div>
      {k.totalBudget > 0 ? (
        <>
          <BudgetBar spent={k.totalSpend} budget={k.totalBudget} thick />
          <div className="mb-4 mt-1 text-right text-[11px] text-muted">{Math.round(used * 100)} % used</div>
        </>
      ) : (
        <p className="mb-3 text-xs text-muted">No budget set for this month. <Link to="/budgets" className="text-brand underline">Set budgets</Link></p>
      )}
      <ul className="space-y-2.5">
        {cats.map((c) => (
          <li key={c.category}>
            <Link to={`/expenses?category=${c.category}${k.month !== currentMonth() ? `&month=${k.month}` : ""}`} className="group block">
              <div className="mb-1 flex items-baseline justify-between text-xs">
                <span className="font-medium group-hover:underline">{catLabel(c.category)}</span>
                <span className="tabular text-muted">{fmtEur(c.spent, true)}{c.budget ? ` / ${fmtEur(c.budget, true)}` : " · no budget"}</span>
              </div>
              <BudgetBar spent={c.spent} budget={c.budget} />
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export function TrendCard({ k, className, metric = "costPerDish" }: { k: KpiSnapshot; className?: string; metric?: "costPerDish" | "tempFoodPct" }) {
  const isCost = metric === "costPerDish";
  const pts = k.trend.map((t) => ({ label: t.label, v: t[metric] }));
  return (
    <Card className={cn("p-4", className)}>
      <h3 className="text-sm font-semibold">{isCost ? "Cost per dish" : "Temporary food %"}, {pts.length} months</h3>
      <div className="mt-3 h-52">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={pts} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
            <CartesianGrid stroke="#eef2f6" vertical={false} />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#64748b" }} />
            <YAxis domain={["auto", "auto"]} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#64748b" }} tickFormatter={(v: number) => (isCost ? `€${v.toFixed(1)}` : `${v.toFixed(0)}%`)} width={48} />
            <Tooltip formatter={(v) => (isCost ? fmtEur(Number(v)) : fmtPct(Number(v)))} contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e2e8f0" }} />
            <Line type="monotone" dataKey="v" name={isCost ? "Cost/dish" : "Temp food"} stroke={isCost ? "#0f766e" : "#d97706"} strokeWidth={2.5} isAnimationActive={false} connectNulls dot={{ r: 3, fill: isCost ? "#0f766e" : "#d97706" }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

export function Kpi(p: { to?: string; label: string; value: string; sub?: string; delta?: number; deltaFmt?: (d: number) => string; lowerIsBetter?: boolean; primary?: boolean }) {
  const good = p.delta !== undefined && (p.lowerIsBetter ? p.delta < 0 : p.delta > 0);
  const Arrow = (p.delta ?? 0) < 0 ? ArrowDownRight : ArrowUpRight;
  const body = (
    <Card className={cn("group h-full p-4 transition-colors", p.to && "hover:border-slate-300", p.primary && "border-brand/40 bg-gradient-to-b from-brand-soft/40 to-surface")}>
      <div className="flex items-center justify-between text-xs text-muted">
        {p.label}
        {p.to && <ChevronRight className="h-3.5 w-3.5 opacity-0 transition-opacity group-hover:opacity-100" />}
      </div>
      <div className={cn("tabular mt-1 font-semibold tracking-tight", p.primary ? "text-2xl lg:text-3xl" : "text-xl lg:text-2xl")}>{p.value}</div>
      <div className="mt-1 flex flex-wrap items-center gap-x-2 text-[11px] text-muted">
        {p.delta !== undefined && p.deltaFmt && (
          <span className={cn("inline-flex items-center font-medium", good ? "text-good" : "text-bad")}>
            <Arrow className="h-3 w-3" />
            {p.deltaFmt(p.delta)}
          </span>
        )}
        {p.sub}
      </div>
    </Card>
  );
  return p.to ? <Link to={p.to}>{body}</Link> : body;
}

export function BudgetBar({ spent, budget, thick }: { spent: number; budget: number; thick?: boolean }) {
  const tone = budget > 0 ? budgetTone(spent, budget) : "none";
  const pct = budget > 0 ? Math.min(100, (spent / budget) * 100) : 0;
  return (
    <div className={cn("relative overflow-hidden rounded-full bg-slate-100", thick ? "h-3" : "h-2")}>
      <div className={cn("h-full rounded-full", tone === "red" ? "bg-bad" : tone === "amber" ? "bg-warn" : "bg-good")} style={{ width: `${pct}%` }} />
      {budget > 0 && <div className="absolute inset-y-0 left-[80%] w-px bg-slate-300" title="80 % alert" />}
    </div>
  );
}
