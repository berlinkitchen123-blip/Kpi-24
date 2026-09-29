import { BrowserRouter, HashRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { Layout } from "@/components/Layout";
import { NAV } from "@/components/nav";
import { Home } from "@/features/dashboard/Home";
import { Login } from "@/features/Login";
import { Placeholder } from "@/features/Placeholder";
import { Settings } from "@/features/settings/Settings";
import { QuickAdd } from "@/features/expenses/QuickAdd";
import { ExpensesList } from "@/features/expenses/ExpensesList";
import { Suppliers } from "@/features/expenses/Suppliers";
import { Budgets } from "@/features/budgets/Budgets";
import { Kpis } from "@/features/kpi/Kpis";
import { Approvals } from "@/features/approvals/Approvals";
import { ToastProvider } from "@/components/overlay";
import type { ReactElement } from "react";

const SCREENS: Record<string, ReactElement> = {
  "/settings": <Settings />,
  "/add": <QuickAdd />,
  "/expenses": <ExpensesList />,
  "/suppliers": <Suppliers />,
  "/budgets": <Budgets />,
  "/kpis": <Kpis />,
  "/approvals": <Approvals />,
};

// Single-file preview has no server routing, so it uses hash URLs.
const Router = import.meta.env.MODE === "preview" ? HashRouter : BrowserRouter;

function Gate() {
  const { user, loading, role, cityId } = useAuth();
  if (loading) return <div className="p-10 text-center text-sm text-muted">Loading…</div>;
  if (!user) return <Login />;
  if (cityId && !role) return <div className="p-10 text-center text-sm">No access to this city. Ask the City Manager for a role.</div>;

  const allowed = NAV.filter((n) => role && n.roles.includes(role));
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        {allowed
          .filter((n) => n.path !== "/")
          .map((n) => <Route key={n.path} path={n.path.slice(1)} element={SCREENS[n.path] ?? <Placeholder />} />)}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
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
