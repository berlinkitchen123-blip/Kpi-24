import { Link } from "react-router-dom";
import { AlertTriangle, Camera, CheckSquare, Receipt } from "lucide-react";
import { useExpenses } from "@/hooks/useLive";
import { currentMonth, fmtDate, fmtEur, todayIso } from "@/lib/format";
import { monthRange } from "@/lib/kpi";
import { catLabel } from "@/features/expenses/ExpenseForm";
import { Card } from "@/components/ui";
import { useAuth, usePermissions } from "@/hooks/useAuth";
import { TodoList } from "@/features/tasks/TodoList";
import { KpiOverview } from "./KpiOverview";

export function Home() {
  const { user, cities, cityId, role } = useAuth();
  const { canSeeDashboard, isManager } = usePermissions();
  const city = cities.find((c) => c.id === cityId);
  const hour = new Date().getHours();
  const greet = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const date = new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight lg:text-2xl">
          {greet}, {user?.name.split(" ")[0]}
        </h1>
        <p className="text-sm text-muted">
          {date} · {city?.name}
          {role === "management" && " · read-only view"}
        </p>
      </div>

      {/* To-do list first, above KPIs (City Manager only) */}
      {isManager && <Attention />}
      {isManager && <TodoList />}

      {role === "staff" && <StaffHome />}

      {canSeeDashboard && (
        <section className="space-y-3">
          <div className="flex items-baseline justify-between">
            <h2 className="text-base font-semibold">This month</h2>
            <Link to="/kpis" className="text-xs text-brand hover:underline">All KPIs</Link>
          </div>
          <KpiOverview />
        </section>
      )}
    </div>
  );
}

/** Items the system itself puts on the manager's desk. */
function Attention() {
  const { from } = monthRange(currentMonth());
  const exp = useExpenses(from, todayIso());
  if (!exp) return null;
  const pending = exp.filter((e) => e.status === "pending").length;
  const missing = exp.filter((e) => !e.receiptUrl).length;
  if (!pending && !missing) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {pending > 0 && (
        <Link to="/approvals" className="inline-flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 hover:border-amber-300">
          <CheckSquare className="h-4 w-4" /> {pending} expense{pending > 1 ? "s" : ""} waiting for approval
        </Link>
      )}
      {missing > 0 && (
        <Link to="/expenses?missing=1" className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 hover:border-red-300">
          <AlertTriangle className="h-4 w-4" /> {missing} missing receipt{missing > 1 ? "s" : ""} this month
        </Link>
      )}
    </div>
  );
}

function StaffHome() {
  const { from } = monthRange(currentMonth());
  const mine = useExpenses(from, todayIso());
  return (
    <div className="space-y-4">
    <div className="grid gap-3 sm:grid-cols-2">
      <Link to="/add">
        <Card className="flex items-center gap-4 border-brand/40 bg-brand-soft/40 p-5 hover:border-brand">
          <div className="rounded-xl bg-brand p-3 text-white"><Camera className="h-6 w-6" /></div>
          <div>
            <div className="font-semibold">Add expense</div>
            <div className="text-xs text-muted">Photo of the receipt + amount, ~15 seconds</div>
          </div>
        </Card>
      </Link>
      <Link to="/expenses">
        <Card className="flex items-center gap-4 p-5 hover:border-slate-300">
          <div className="rounded-xl bg-slate-100 p-3"><Receipt className="h-6 w-6" /></div>
          <div>
            <div className="font-semibold">My entries</div>
            <div className="text-xs text-muted">Only your own expenses are visible</div>
          </div>
        </Card>
      </Link>
    </div>
      {mine && mine.length > 0 && (
        <Card className="overflow-hidden">
          <div className="border-b border-line px-4 py-2.5 text-sm font-semibold">My entries this month</div>
          <ul className="divide-y divide-line text-sm">
            {mine.slice(0, 8).map((e) => (
              <li key={e.id} className="flex items-center gap-3 px-4 py-2">
                <span className="w-14 text-xs text-muted">{fmtDate(e.date)}</span>
                <span className="flex-1 truncate">{e.supplier} · {catLabel(e.category)}</span>
                {e.status === "pending" && <span className="text-[11px] text-amber-700">pending</span>}
                <span className="tabular font-medium">{fmtEur(e.amount)}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
