import { EXPENSE_CATEGORIES, type Budget, type CategoryId, type Expense, type KpiSnapshot, type Revenue } from "@/types";

const pad = (n: number) => String(n).padStart(2, "0");

export const monthRange = (m: string) => {
  const [y, mo] = m.split("-").map(Number);
  return { from: `${m}-01`, to: `${m}-${pad(new Date(y, mo, 0).getDate())}` };
};

/** The n months ending with m, oldest first. */
export function lastMonths(m: string, n: number) {
  const [y, mo] = m.split("-").map(Number);
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(y, mo - 1 - (n - 1 - i), 1);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
  });
}

export const shiftMonth = (m: string, by: number) => {
  const [y, mo] = m.split("-").map(Number);
  const d = new Date(y, mo - 1 + by, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
};

export const monthLabel = (m: string, style: "short" | "long" = "short") => {
  const [y, mo] = m.split("-").map(Number);
  return new Date(y, mo - 1, 1).toLocaleDateString("en-GB", style === "short" ? { month: "short" } : { month: "long", year: "numeric" });
};

// Categories that are billed in lumps (rent on the 1st, payroll on the 28th): a straight-line
// forecast would be wrong, so they are forecast as max(spent so far, last month's total).
const LUMPY: CategoryId[] = ["fixed", "employees", "utilities"];

const sumBy = (xs: Expense[], f: (e: Expense) => boolean) => xs.reduce((s, e) => (f(e) ? s + e.amount : s), 0);

/**
 * All headline KPIs for `month`, from raw expenses of that month and the months before it.
 * `today` lets the current month be forecast; past months forecast = actual.
 */
export function computeKpi(
  month: string,
  months: string[],
  expenses: Expense[],
  budgets: Record<string, Budget>,
  revenue: Record<string, Revenue>,
  today = new Date(),
): KpiSnapshot {
  const byMonth = (m: string) => expenses.filter((e) => e.date.startsWith(m));
  const cur = byMonth(month);
  const prevM = months[months.indexOf(month) - 1];
  const prev = prevM ? byMonth(prevM) : [];

  const stats = (m: string, xs: Expense[]) => {
    const r = revenue[m];
    const spend = sumBy(xs, () => true);
    const temp = sumBy(xs, (e) => e.category === "tempfood");
    const dishes = r?.dishesSold ?? 0;
    return {
      spend,
      costPerDish: dishes > 0 ? spend / dishes : null,
      tempFoodPct: r && temp + r.plannedFoodCost > 0 ? (temp / (temp + r.plannedFoodCost)) * 100 : null,
    };
  };

  const curMonthStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}`;
  const isCurrent = month === curMonthStr;
  const [y, mo] = month.split("-").map(Number);
  const daysInMonth = new Date(y, mo, 0).getDate();
  const elapsed = isCurrent ? today.getDate() : daysInMonth;

  const rev = revenue[month];
  const dishes = rev?.dishesSold ?? 0;
  const budget = budgets[month] ?? {};

  let forecast = 0;
  const byCategory = EXPENSE_CATEGORIES.map(({ id }) => {
    const spent = sumBy(cur, (e) => e.category === id);
    const prevSpent = sumBy(prev, (e) => e.category === id);
    forecast += !isCurrent ? spent : LUMPY.includes(id) ? Math.max(spent, prevSpent) : (spent / elapsed) * daysInMonth;
    return { category: id, spent, budget: budget[id] ?? 0, perDish: dishes > 0 ? spent / dishes : 0 };
  });

  const s = stats(month, cur);
  const p = prevM ? stats(prevM, prev) : null;
  const employees = sumBy(cur, (e) => e.category === "employees");
  const electricity = sumBy(cur, (e) => e.category === "utilities" && e.subcategory === "Electricity");
  const nonfood = sumBy(cur, (e) => e.category === "nonfood");

  return {
    month,
    costPerDish: s.costPerDish ?? 0,
    costPerDishPrev: p?.costPerDish ?? null,
    labourPct: rev && rev.amount > 0 ? (employees / rev.amount) * 100 : null,
    tempFoodPct: s.tempFoodPct,
    tempFoodPctPrev: p?.tempFoodPct ?? null,
    electricityPerDish: dishes > 0 ? electricity / dishes : 0,
    nonFoodPerDish: dishes > 0 ? nonfood / dishes : 0,
    totalSpend: s.spend,
    totalBudget: Object.values(budget).reduce((a, b) => a + (b ?? 0), 0),
    forecast,
    dishesSold: dishes,
    revenue: rev?.amount ?? 0,
    byCategory,
    trend: months.slice(0, months.indexOf(month) + 1).map((m) => {
      const st = stats(m, byMonth(m));
      return { month: m, label: monthLabel(m), costPerDish: st.costPerDish, tempFoodPct: st.tempFoodPct, spend: st.spend };
    }),
  };
}
