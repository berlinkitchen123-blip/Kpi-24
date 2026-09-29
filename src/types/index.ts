// Shared domain types. Every city-scoped record lives under cities/{cityId}/...

export type Role = "manager" | "staff" | "management";

/** Roles are set per city: { essen: "manager", dortmund: "management" } */
export type CityRoles = Record<string, Role>;

export interface AppUser {
  uid: string;
  name: string;
  email: string;
  roles: CityRoles;
}

export interface City {
  id: string;
  name: string;
  active: boolean;
}

export const EXPENSE_CATEGORIES = [
  { id: "nonfood", label: "Non-food", subs: ["Packaging", "Cleaning", "Consumables", "Smallwares", "Uniforms", "Equipment", "Office"] },
  { id: "tempfood", label: "Temporary food", subs: ["Spot buy", "Emergency", "Shortage"] },
  { id: "logistics", label: "Logistics", subs: ["Vehicle lease", "Vehicle rental", "3rd-party delivery", "Tolls", "Parking", "Repairs"] },
  { id: "fuel", label: "Fuel", subs: ["Diesel", "Petrol", "EV charging"] },
  { id: "employees", label: "Employees", subs: ["Payroll", "Minijob", "Agency staff", "Overtime", "Recruitment"] },
  { id: "utilities", label: "Utilities", subs: ["Electricity", "Gas", "Water", "Internet"] },
  { id: "fixed", label: "Fixed & other", subs: ["Rent", "Insurance", "Maintenance", "Licences", "Misc"] },
] as const;

export type CategoryId = (typeof EXPENSE_CATEGORIES)[number]["id"];

export type TaskSource = "email" | "teams" | "manual";
export type TaskPriority = "high" | "normal" | "low";
export type TaskStatus = "open" | "done" | "snoozed";

/** Only metadata is stored — never full email or chat text. */
export interface Task {
  id: string;
  title: string;
  source: TaskSource;
  sender: string;
  dueDate: string | null; // YYYY-MM-DD
  priority: TaskPriority;
  link: string | null;
  status: TaskStatus;
  snoozedUntil: string | null; // ISO datetime
  createdAt: string; // ISO datetime
}

export interface SyncState {
  lastSyncedAt: string | null;
}

export type PaymentMethod = "card" | "cash" | "bank" | "invoice";
export type ExpenseStatus = "pending" | "approved";

export interface Expense {
  id: string;
  cityId: string;
  date: string; // YYYY-MM-DD
  amount: number; // gross EUR
  vatRate: number; // 19 | 7 | 0
  category: CategoryId;
  subcategory: string;
  supplier: string;
  paymentMethod: PaymentMethod;
  receiptUrl: string | null;
  enteredBy: string; // uid
  enteredByName: string;
  status: ExpenseStatus;
  note: string;
  vehicleId?: string | null;
  createdAt: string;
}

export type NewExpense = Omit<Expense, "id" | "createdAt">;

/** cities/{cityId}/budgets/{YYYY-MM} — one doc per month, amount per category */
export type Budget = Partial<Record<CategoryId, number>>;

/** cities/{cityId}/revenue/{YYYY-MM} */
export interface Revenue {
  amount: number;
  dishesSold: number;
  plannedFoodCost: number; // planned food ordering (later from NRW Stock Planner)
}

/** cities/{cityId}/config/general */
export interface CityConfig {
  approvalLimit: number;
}

export interface CategoryKpi {
  category: CategoryId;
  spent: number;
  budget: number;
  perDish: number;
}

/** Headline numbers, calculated from expenses + revenue + budgets. */
export interface KpiSnapshot {
  month: string;
  costPerDish: number;
  costPerDishPrev: number | null;
  labourPct: number | null;
  tempFoodPct: number | null;
  tempFoodPctPrev: number | null;
  electricityPerDish: number;
  nonFoodPerDish: number;
  totalSpend: number;
  totalBudget: number;
  forecast: number;
  dishesSold: number;
  revenue: number;
  byCategory: CategoryKpi[];
  trend: { month: string; label: string; costPerDish: number | null; tempFoodPct: number | null; spend: number }[];
}
