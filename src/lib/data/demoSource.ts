import type { Budget, City, CityConfig, Expense, Revenue, SyncState, Task } from "@/types";
import { DEFAULT_CONFIG, type DataSource } from "./types";

// In-memory sample data for the preview. Nothing is persisted; reload resets it.

const now = new Date();
const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const day = (offset: number) => {
  const d = new Date(now);
  d.setDate(d.getDate() + offset);
  return ymd(d);
};
const ago = (hours: number) => new Date(now.getTime() - hours * 3600_000).toISOString();

const cities: City[] = [
  { id: "essen", name: "Essen", active: true },
  { id: "dortmund", name: "Dortmund", active: false },
];

let tasks: Task[] = [
  { id: "t1", title: "Confirm Tuesday supplier delivery window", source: "email", sender: "Supplier – Frischedienst", dueDate: day(0), priority: "high", link: "#", status: "open", snoozedUntil: null, createdAt: ago(2) },
  { id: "t2", title: "Approve Van 2 repair quote (brakes)", source: "teams", sender: "Driver – Van 2", dueDate: day(1), priority: "high", link: "#", status: "open", snoozedUntil: null, createdAt: ago(5) },
  { id: "t3", title: "Send September utility meter readings", source: "email", sender: "Facility management", dueDate: day(2), priority: "normal", link: "#", status: "open", snoozedUntil: null, createdAt: ago(20) },
  { id: "t4", title: "Review weekend Minijob shift plan", source: "teams", sender: "Kitchen Lead", dueDate: day(3), priority: "normal", link: "#", status: "open", snoozedUntil: null, createdAt: ago(26) },
  { id: "t5", title: "TÜV appointment for Van 1 – pick a slot", source: "email", sender: "Fleet partner", dueDate: day(9), priority: "low", link: "#", status: "open", snoozedUntil: null, createdAt: ago(48) },
  { id: "t6", title: "Upload missing METRO receipt (12 Sep)", source: "manual", sender: "System", dueDate: day(-2), priority: "high", link: null, status: "open", snoozedUntil: null, createdAt: ago(72) },
  { id: "t7", title: "Reply to insurance renewal offer", source: "email", sender: "Insurance broker", dueDate: day(5), priority: "normal", link: "#", status: "done", snoozedUntil: null, createdAt: ago(96) },
];

let sync: SyncState = { lastSyncedAt: ago(0.3) };
let config: CityConfig = { ...DEFAULT_CONFIG };

// ---- Seeded sample expenses for the last 6 months -------------------------------------------
let seed = 42;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const between = (a: number, b: number) => Math.round((a + rnd() * (b - a)) * 100) / 100;

const expenses: Expense[] = [];
const budgets: Record<string, Budget> = {};
const revenue: Record<string, Revenue> = {};
let idc = 0;

function add(date: string, amount: number, category: Expense["category"], subcategory: string, supplier: string, pm: Expense["paymentMethod"], opts: Partial<Expense> = {}) {
  expenses.push({
    id: `e${++idc}`, cityId: "essen", date, amount, vatRate: opts.vatRate ?? 19, category, subcategory, supplier,
    paymentMethod: pm, receiptUrl: rnd() < 0.12 ? null : "#receipt", enteredBy: opts.enteredBy ?? "demo-harsh",
    enteredByName: opts.enteredByName ?? "Harsh", status: opts.status ?? "approved", note: opts.note ?? "",
    vehicleId: opts.vehicleId ?? null, createdAt: `${date}T10:00:00.000Z`,
  });
}

for (let back = 5; back >= 0; back--) {
  const first = new Date(now.getFullYear(), now.getMonth() - back, 1);
  const month = `${first.getFullYear()}-${pad(first.getMonth() + 1)}`;
  const lastDay = back === 0 ? now.getDate() : new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const d = (n: number) => `${month}-${pad(Math.min(n, lastDay))}`;
  const progress = lastDay / new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const age = 5 - back; // 0 = oldest

  add(d(1), 5500, "fixed", "Rent", "Vermieter GmbH", "bank", { vatRate: 0 });
  add(d(1), 890, "fixed", "Insurance", "Allianz", "bank", { vatRate: 0 });
  add(d(3), 59.9, "utilities", "Internet", "Telekom", "bank");
  add(d(2), 649, "logistics", "Vehicle lease", "Sixt Leasing", "bank", { vehicleId: "van1" });
  add(d(2), 649, "logistics", "Vehicle lease", "Sixt Leasing", "bank", { vehicleId: "van2" });
  if (lastDay >= 28 || back > 0) {
    add(d(28), between(14800, 15600), "employees", "Payroll", "Lohnabrechnung", "bank", { vatRate: 0 });
    add(d(28), between(1900, 2300), "employees", "Minijob", "Minijob-Zentrale", "bank", { vatRate: 0 });
    add(d(28), between(1600, 2000), "utilities", "Electricity", "Stadtwerke Essen", "bank");
    add(d(28), between(300, 450), "utilities", "Gas", "Stadtwerke Essen", "bank");
    add(d(28), between(120, 170), "utilities", "Water", "Stadtwerke Essen", "bank");
  }
  if (age % 2 === 0) add(d(15), between(700, 1300), "employees", "Agency staff", "Randstad", "invoice");
  for (let i = 0; i < Math.round(12 * progress); i++) {
    const van = i % 2 ? "van2" : "van1";
    add(d(2 + i * 2), between(55, 92), "fuel", "Diesel", i % 3 ? "Shell" : "Aral", "card", {
      vehicleId: van, enteredBy: "demo-driver", enteredByName: "Driver (Van 2)",
    });
  }
  for (let i = 0; i < Math.round(6 * progress); i++) add(d(3 + i * 4), between(8, 35), "logistics", i % 2 ? "Parking" : "Tolls", "Parkhaus / Maut", "card", { enteredBy: "demo-driver", enteredByName: "Driver (Van 2)" });
  add(d(9), between(1500, 2100), "nonfood", "Packaging", "Pacovis", "invoice");
  add(d(12), between(450, 700), "nonfood", "Cleaning", "METRO Essen", "card");
  add(d(18), between(300, 600), "nonfood", "Consumables", "Amazon Business", "card");
  if (age % 3 === 1) add(d(20), between(250, 650), "nonfood", "Smallwares", "METRO Essen", "card");
  // Temporary food: fewer spot buys each month (discipline KPI trending down)
  const spot = Math.max(3, 10 - age);
  for (let i = 0; i < Math.round(spot * progress); i++) add(d(1 + i * 3), between(160, 420), "tempfood", i % 3 ? "Spot buy" : "Shortage", "METRO Essen", "card", { vatRate: 7 });
  if (age === 2) add(d(14), 780, "logistics", "Repairs", "ATU Essen", "card", { vehicleId: "van1" });

  budgets[month] = { employees: 20000, fixed: 6500, utilities: 2600, logistics: 2300, fuel: 1100, nonfood: 3400, tempfood: 1800 };
  const dishes = Math.round((6800 + age * 120) * progress);
  revenue[month] = { amount: Math.round(dishes * 8.9), dishesSold: dishes, plannedFoodCost: Math.round(dishes * 2.35) };
}
// A couple of staff entries waiting for approval this month
add(day(-1), 238.5, "logistics", "Repairs", "Reifen Müller", "cash", { enteredBy: "demo-driver", enteredByName: "Driver (Van 2)", status: "pending", vehicleId: "van2", note: "Tyre puncture" });

// ---- Pub/sub --------------------------------------------------------------------------------
type Listener = () => void;
const listeners = new Set<Listener>();
const emit = () => listeners.forEach((l) => l());
const sub = (push: () => void) => {
  listeners.add(push);
  push();
  return () => void listeners.delete(push);
};

export const demoSource: DataSource = {
  kind: "demo",

  async listCities(ids) {
    return cities.filter((c) => ids.includes(c.id));
  },

  subscribeTasks: (cityId, cb) => sub(() => cb(cityId === "essen" ? [...tasks] : [])),
  async addTask(_c, t) {
    tasks = [{ ...t, id: crypto.randomUUID(), createdAt: new Date().toISOString() }, ...tasks];
    emit();
  },
  async updateTask(_c, id, patch) {
    tasks = tasks.map((t) => (t.id === id ? { ...t, ...patch } : t));
    emit();
  },
  subscribeSync: (cb) => sub(() => cb(sync)),

  subscribeExpenses: (cityId, q, cb) =>
    sub(() =>
      cb(
        expenses
          .filter((e) => e.cityId === cityId && e.date >= q.from && e.date <= q.to && (!q.onlyUid || e.enteredBy === q.onlyUid))
          .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)),
      ),
    ),
  async addExpense(_c, e) {
    const id = `e${++idc}`;
    expenses.push({ ...e, id, createdAt: new Date().toISOString() });
    emit();
    return id;
  },
  async updateExpense(_c, id, patch) {
    const i = expenses.findIndex((e) => e.id === id);
    if (i >= 0) expenses[i] = { ...expenses[i], ...patch, id };
    emit();
  },
  async deleteExpense(_c, id) {
    const i = expenses.findIndex((e) => e.id === id);
    if (i >= 0) expenses.splice(i, 1);
    emit();
  },
  async uploadReceipt(_c, _u, file) {
    await new Promise((r) => setTimeout(r, 250));
    return URL.createObjectURL(file);
  },

  subscribeBudgets: (cityId, months, cb) =>
    sub(() => cb(cityId === "essen" ? Object.fromEntries(months.filter((m) => budgets[m]).map((m) => [m, { ...budgets[m] }])) : {})),
  async setBudget(_c, m, b) {
    budgets[m] = { ...b };
    emit();
  },
  subscribeRevenue: (cityId, months, cb) =>
    sub(() => cb(cityId === "essen" ? Object.fromEntries(months.filter((m) => revenue[m]).map((m) => [m, { ...revenue[m] }])) : {})),
  async setRevenue(_c, m, r) {
    revenue[m] = { ...r };
    emit();
  },

  subscribeConfig: (_c, cb) => sub(() => cb({ ...config })),
  async setConfig(_c, c) {
    config = { ...config, ...c };
    emit();
  },
};

/** Demo-only helper to simulate a sync run. */
export function demoTouchSync() {
  sync = { lastSyncedAt: new Date().toISOString() };
  emit();
}
