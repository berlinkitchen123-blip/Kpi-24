import { lazy, Suspense } from "react";
import { BrowserRouter, HashRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { Layout } from "@/components/Layout";
import { NAV } from "@/components/nav";
import { Home } from "@/features/dashboard/Home";
import { Login } from "@/features/Login";
import { Placeholder } from "@/features/Placeholder";
import { ToastProvider } from "@/components/overlay";
import type { ReactElement } from "react";

// Everything except Home (the index route, always needed first) is code-split per
// route: each is its own chunk, fetched only when that screen is actually opened.
const Settings = lazy(() => import("@/features/settings/Settings").then((m) => ({ default: m.Settings })));
const QuickAdd = lazy(() => import("@/features/expenses/QuickAdd").then((m) => ({ default: m.QuickAdd })));
const ExpensesList = lazy(() => import("@/features/expenses/ExpensesList").then((m) => ({ default: m.ExpensesList })));
const Suppliers = lazy(() => import("@/features/expenses/Suppliers").then((m) => ({ default: m.Suppliers })));
const SupplierInsights = lazy(() => import("@/features/expenses/SupplierInsights").then((m) => ({ default: m.SupplierInsights })));
const Budgets = lazy(() => import("@/features/budgets/Budgets").then((m) => ({ default: m.Budgets })));
const Kpis = lazy(() => import("@/features/kpi/Kpis").then((m) => ({ default: m.Kpis })));
const Approvals = lazy(() => import("@/features/approvals/Approvals").then((m) => ({ default: m.Approvals })));
const Utilities = lazy(() => import("@/features/utilities/Utilities").then((m) => ({ default: m.Utilities })));

const SCREENS: Record<string, ReactElement> = {
  "/settings": <Settings />,
  "/add": <QuickAdd />,
  "/expenses": <ExpensesList />,
  "/suppliers": <Suppliers />,
  "/budgets": <Budgets />,
  "/kpis": <Kpis />,
  "/approvals": <Approvals />,
  "/utilities": <Utilities />,
};

const RouteFallback = () => <div className="p-10 text-center text-sm text-muted">Loading…</div>;

// Single-file preview has no server routing, so it uses hash URLs.
const Router = import.meta.env.MODE === "preview" ? HashRouter : BrowserRouter;

function Gate() {
  const { user, loading, role, cityId } = useAuth();
  if (loading) return <div className="p-10 text-center text-sm text-muted">Loading…</div>;
  if (!user) return <Login />;
  if (cityId && !role) return <div className="p-10 text-center text-sm">No access to this city. Ask the City Manager for a role.</div>;

  const allowed = NAV.filter((n) => role && n.roles.includes(role));
  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Home />} />
          {allowed
            .filter((n) => n.path !== "/")
            .map((n) => <Route key={n.path} path={n.path.slice(1)} element={SCREENS[n.path] ?? <Placeholder />} />)}
          {allowed.some((n) => n.path === "/suppliers") && <Route path="suppliers/insights" element={<SupplierInsights />} />}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </Suspense>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <Router>
          <Gate />
        </Router>
      </ToastProvider>
    </AuthProvider>
  );
}
