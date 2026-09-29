import { useState } from "react";
import { Link } from "react-router-dom";
import { Card } from "@/components/ui";
import { MonthPicker } from "@/components/MonthPicker";
import { useMonthKpi } from "@/hooks/useLive";
import { budgetTone, cn, currentMonth, fmtEur, fmtPct } from "@/lib/format";
import { catLabel } from "@/features/expenses/ExpenseForm";
import { BudgetCard, Kpi, TrendCard } from "@/features/dashboard/KpiOverview";

export function Kpis() {
  const [month, setMonth] = useState(currentMonth());
  const k = useMonthKpi(month);
  const isCurrent = month === currentMonth();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="mr-auto text-xl font-semibold">KPIs</h1>
        <MonthPicker value={month} onChange={setMonth} />
      </div>
      {!k ? (
        <Card className="h-40 animate-pulse" />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi label="Cost per dish" primary value={k.dishesSold ? fmtEur(k.costPerDish) : "–"} delta={k.costPerDishPrev != null && k.dishesSold ? k.costPerDish - k.costPerDishPrev : undefined} deltaFmt={(d) => fmtEur(Math.abs(d))} lowerIsBetter sub="vs previous month" />
            <Kpi label="Labour" value={k.labourPct == null ? "–" : fmtPct(k.labourPct)} sub="employees ÷ revenue" />
            <Kpi label="Temporary food" value={k.tempFoodPct == null ? "–" : fmtPct(k.tempFoodPct)} delta={k.tempFoodPct != null && k.tempFoodPctPrev != null ? k.tempFoodPct - k.tempFoodPctPrev : undefined} deltaFmt={(d) => `${Math.abs(d).toFixed(1)} pp`} lowerIsBetter sub="of total food spend" />
            <Kpi label="Margin" value={k.revenue ? fmtEur(k.revenue - k.totalSpend, true) : "–"} sub={k.revenue ? fmtPct(((k.revenue - k.totalSpend) / k.revenue) * 100) : "no revenue"} />
            <Kpi label="Electricity per dish" value={k.dishesSold ? fmtEur(k.electricityPerDish) : "–"} />
            <Kpi label="Non-food per dish" value={k.dishesSold ? fmtEur(k.nonFoodPerDish) : "–"} />
            <Kpi label={isCurrent ? "Month-end forecast" : "Total spend"} value={fmtEur(isCurrent ? k.forecast : k.totalSpend, true)} sub={k.totalBudget ? `budget ${fmtEur(k.totalBudget, true)}` : "no budget"} />
            <Kpi label="Dishes sold" value={k.dishesSold.toLocaleString("de-DE")} sub={k.revenue ? `${fmtEur(k.revenue / Math.max(1, k.dishesSold))} avg price` : undefined} />
          </div>

          <Card className="overflow-hidden">
            <div className="border-b border-line px-4 py-3 text-sm font-semibold">Cost per dish by category</div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-sm">
                <thead className="bg-slate-50 text-left text-xs text-muted">
                  <tr>
                    <th className="px-4 py-2 font-medium">Category</th>
                    <th className="px-2 py-2 text-right font-medium">Per dish</th>
                    <th className="px-2 py-2 text-right font-medium">Actual</th>
                    <th className="px-2 py-2 text-right font-medium">Budget</th>
                    <th className="px-4 py-2 text-right font-medium">Used</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {k.byCategory.map((c) => {
                    const tone = c.budget ? budgetTone(c.spent, c.budget) : null;
                    return (
                      <tr key={c.category} className="hover:bg-slate-50">
                        <td className="px-4 py-2.5">
                          <Link className="font-medium hover:underline" to={`/expenses?category=${c.category}${isCurrent ? "" : `&month=${month}`}`}>{catLabel(c.category)}</Link>
                        </td>
                        <td className="tabular px-2 py-2.5 text-right">{k.dishesSold ? fmtEur(c.perDish) : "–"}</td>
                        <td className="tabular px-2 py-2.5 text-right">{fmtEur(c.spent, true)}</td>
                        <td className="tabular px-2 py-2.5 text-right text-muted">{c.budget ? fmtEur(c.budget, true) : "–"}</td>
                        <td className={cn("tabular px-4 py-2.5 text-right font-medium", tone === "red" ? "text-bad" : tone === "amber" ? "text-warn" : "text-good")}>
                          {c.budget ? `${Math.round((c.spent / c.budget) * 100)} %` : "–"}
                        </td>
                      </tr>
                    );
                  })}
                  <tr className="bg-slate-50 font-semibold">
                    <td className="px-4 py-2.5">Total</td>
                    <td className="tabular px-2 py-2.5 text-right">{k.dishesSold ? fmtEur(k.costPerDish) : "–"}</td>
                    <td className="tabular px-2 py-2.5 text-right">{fmtEur(k.totalSpend, true)}</td>
                    <td className="tabular px-2 py-2.5 text-right">{k.totalBudget ? fmtEur(k.totalBudget, true) : "–"}</td>
                    <td className="tabular px-4 py-2.5 text-right">{k.totalBudget ? `${Math.round((k.totalSpend / k.totalBudget) * 100)} %` : "–"}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <TrendCard k={k} metric="costPerDish" />
            <TrendCard k={k} metric="tempFoodPct" />
          </div>
          <BudgetCard k={k} />
          <p className="text-xs text-muted">
            Fuel cost per km and l/100 km per vehicle arrive in Phase 4 (calculated from odometer readings). Forecast: rent, payroll and utilities use last month's total; other categories are extrapolated from the daily spend rate.
          </p>
        </>
      )}
    </div>
  );
}
