import type { Budget, City, CityConfig, Expense, MeterReading, NewExpense, Revenue, SyncState, Task } from "@/types";

export type Unsubscribe = () => void;

export interface ExpenseQuery {
  from: string; // YYYY-MM-DD inclusive
  to: string; // YYYY-MM-DD inclusive
  onlyUid?: string; // staff: only own entries (required by security rules)
}

/**
 * One interface, two implementations:
 *  - firebaseSource: live Firestore (production)
 *  - demoSource: in-memory sample data (preview / no config)
 * UI code only talks to this interface.
 */
export interface DataSource {
  kind: "firebase" | "demo";
  listCities(cityIds: string[]): Promise<City[]>;

  subscribeTasks(cityId: string, cb: (tasks: Task[]) => void): Unsubscribe;
  addTask(cityId: string, task: Omit<Task, "id" | "createdAt">): Promise<void>;
  updateTask(cityId: string, id: string, patch: Partial<Task>): Promise<void>;
  subscribeSync(cb: (s: SyncState) => void): Unsubscribe;

  subscribeExpenses(cityId: string, q: ExpenseQuery, cb: (e: Expense[]) => void): Unsubscribe;
  addExpense(cityId: string, e: NewExpense): Promise<string>;
  updateExpense(cityId: string, id: string, patch: Partial<Expense>): Promise<void>;
  deleteExpense(cityId: string, id: string): Promise<void>;
  /** Compresses and uploads a receipt image/PDF, returns its URL. */
  uploadReceipt(cityId: string, uid: string, file: Blob, name: string): Promise<string>;

  subscribeBudgets(cityId: string, months: string[], cb: (b: Record<string, Budget>) => void): Unsubscribe;
  setBudget(cityId: string, month: string, b: Budget): Promise<void>;
  subscribeRevenue(cityId: string, months: string[], cb: (r: Record<string, Revenue>) => void): Unsubscribe;
  setRevenue(cityId: string, month: string, r: Revenue): Promise<void>;

  subscribeMeterReadings(cityId: string, months: string[], cb: (r: Record<string, MeterReading>) => void): Unsubscribe;
  setMeterReading(cityId: string, month: string, r: MeterReading): Promise<void>;

  subscribeConfig(cityId: string, cb: (c: CityConfig) => void): Unsubscribe;
  setConfig(cityId: string, c: CityConfig): Promise<void>;
}

export const DEFAULT_CONFIG: CityConfig = { approvalLimit: 200 };
