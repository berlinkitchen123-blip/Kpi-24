import {
  BarChart3, Building2, CheckSquare, Fuel, Gauge, History, Home, Lock, PiggyBank,
  PlusCircle, Receipt, Settings, Users, Zap, type LucideIcon,
} from "lucide-react";
import type { Role } from "@/types";

export interface NavItem {
  path: string;
  label: string;
  icon: LucideIcon;
  roles: Role[];
  phase: number; // build phase in which the screen goes live
  mobile?: boolean; // shown in the bottom bar on phones
}

const ALL: Role[] = ["manager", "staff", "management"];
const MGR: Role[] = ["manager"];
const READ: Role[] = ["manager", "management"];

export const NAV: NavItem[] = [
  { path: "/", label: "Home", icon: Home, roles: ALL, phase: 1, mobile: true },
  { path: "/add", label: "Quick Add", icon: PlusCircle, roles: ["manager", "staff"], phase: 2, mobile: true },
  { path: "/expenses", label: "Expenses", icon: Receipt, roles: ALL, phase: 2, mobile: true },
  { path: "/kpis", label: "KPIs", icon: Gauge, roles: READ, phase: 3, mobile: true },
  { path: "/budgets", label: "Budgets", icon: PiggyBank, roles: READ, phase: 3 },
  { path: "/fuel", label: "Fuel & Vehicles", icon: Fuel, roles: ALL, phase: 4 },
  { path: "/employees", label: "Employees", icon: Users, roles: READ, phase: 4 },
  { path: "/utilities", label: "Utilities", icon: Zap, roles: READ, phase: 4 },
  { path: "/suppliers", label: "Suppliers", icon: Building2, roles: READ, phase: 2 },
  { path: "/approvals", label: "Approvals", icon: CheckSquare, roles: MGR, phase: 3 },
  { path: "/reports", label: "Reports", icon: BarChart3, roles: READ, phase: 6 },
  { path: "/month-close", label: "Month Close", icon: Lock, roles: MGR, phase: 5 },
  { path: "/audit", label: "Audit Log", icon: History, roles: READ, phase: 5 },
  { path: "/settings", label: "Settings & Users", icon: Settings, roles: MGR, phase: 1 },
];

/** Screens up to this phase are built. */
export const LIVE_PHASE = 3;

export const PHASES: Record<number, string> = {
  1: "Foundation",
  2: "Expenses core",
  3: "Budgets & dashboard",
  4: "Fuel, vehicles, employees, utilities",
  5: "Control layer",
  6: "Reports, receipt scan, bank import",
};
