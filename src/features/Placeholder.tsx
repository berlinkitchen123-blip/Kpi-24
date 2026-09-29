import { useLocation } from "react-router-dom";
import { Hammer } from "lucide-react";
import { Card } from "@/components/ui";
import { NAV, PHASES } from "@/components/nav";

const PLANNED: Record<string, string[]> = {
  "/add": ["Amount, category, supplier, payment method in ~15 s", "Receipt photo from the phone camera", "Works offline, syncs when back online"],
  "/expenses": ["Filters by month, category, supplier, person", "Missing-receipt flag", "Staff see only their own entries"],
  "/suppliers": ["Supplier master data", "Spend per supplier", "Price watch on repeat purchases"],
  "/kpis": ["Cost per dish total and per category", "Labour %, logistics per delivery, fuel per km", "Drill-down: KPI → category → single bill"],
  "/budgets": ["Monthly budget per category", "Green / amber 80 % / red 100 %", "Month-end forecast from spend rate"],
  "/fuel": ["Fill-ups with litres, amount, odometer", "l/100 km and cost per km from odometer", "Cost per vehicle"],
  "/employees": ["Payroll, Minijob, agency, overtime, recruitment", "Labour % of revenue"],
  "/utilities": ["Electricity, gas, water, internet", "Electricity cost per dish"],
  "/approvals": ["Spend above your limit waits for approval", "Who, when, what – logged"],
  "/reports": ["Excel and PDF", "Budget vs actual, KPI trends", "Weekly Monday summary"],
  "/month-close": ["Lock a month – no more edits", "Generate the month report"],
  "/audit": ["Every change: who, when, before/after"],
};

export function Placeholder() {
  const { pathname } = useLocation();
  const item = NAV.find((n) => n.path === pathname);
  if (!item) return null;
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">{item.label}</h1>
      <Card className="p-6">
        <div className="flex items-center gap-2 text-sm font-medium text-muted">
          <Hammer className="h-4 w-4" /> Coming in Phase {item.phase} · {PHASES[item.phase]}
        </div>
        {PLANNED[pathname] && (
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">
            {PLANNED[pathname].map((p) => <li key={p}>{p}</li>)}
          </ul>
        )}
      </Card>
    </div>
  );
}
