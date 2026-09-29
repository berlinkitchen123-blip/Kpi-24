import {
  addDoc, collection, deleteDoc, doc, getDoc, onSnapshot, orderBy, query, serverTimestamp, setDoc, updateDoc, where,
  type QueryConstraint, type Timestamp,
} from "firebase/firestore";
import { fb } from "@/lib/firebase/config";
import { blobToDataUrl } from "@/lib/image";
import type { Budget, City, Expense, MeterReading, Revenue, Task } from "@/types";
import { DEFAULT_CONFIG, type DataSource } from "./types";

const iso = (v: unknown): string | null =>
  v == null ? null : typeof v === "string" ? v : (v as Timestamp).toDate().toISOString();

/** Subscribe to several docs and emit a combined map once each has reported. */
function subscribeDocs<T>(paths: [string, string][], cb: (m: Record<string, T>) => void) {
  const { db } = fb();
  const out: Record<string, T> = {};
  const seen = new Set<string>();
  const unsubs = paths.map(([key, path]) =>
    onSnapshot(doc(db, path), (s) => {
      if (s.exists()) out[key] = s.data() as T;
      else delete out[key];
      seen.add(key);
      if (seen.size === paths.length) cb({ ...out });
    }),
  );
  if (paths.length === 0) cb({});
  return () => unsubs.forEach((u) => u());
}

export const firebaseSource: DataSource = {
  kind: "firebase",

  async listCities(cityIds) {
    const { db } = fb();
    const snaps = await Promise.all(cityIds.map((id) => getDoc(doc(db, "cities", id))));
    return snaps.filter((s) => s.exists()).map((s) => ({ id: s.id, ...(s.data() as Omit<City, "id">) }));
  },

  subscribeTasks(cityId, cb) {
    const { db } = fb();
    const q = query(collection(db, "cities", cityId, "tasks"), orderBy("createdAt", "desc"));
    return onSnapshot(q, (snap) =>
      cb(
        snap.docs.map((d) => {
          const x = d.data();
          return {
            id: d.id, title: x.title, source: x.source, sender: x.sender ?? "", dueDate: x.dueDate ?? null,
            priority: x.priority ?? "normal", link: x.link ?? null, status: x.status ?? "open",
            snoozedUntil: iso(x.snoozedUntil), createdAt: iso(x.createdAt) ?? new Date().toISOString(),
          } satisfies Task;
        }),
      ),
    );
  },
  async addTask(cityId, task) {
    await addDoc(collection(fb().db, "cities", cityId, "tasks"), { ...task, createdAt: serverTimestamp() });
  },
  async updateTask(cityId, id, patch) {
    await updateDoc(doc(fb().db, "cities", cityId, "tasks", id), { ...patch, updatedAt: serverTimestamp() });
  },
  subscribeSync(cb) {
    return onSnapshot(doc(fb().db, "system", "sync"), (s) => cb({ lastSyncedAt: iso(s.data()?.lastSyncedAt) }));
  },

  subscribeExpenses(cityId, q, cb) {
    const c: QueryConstraint[] = [where("date", ">=", q.from), where("date", "<=", q.to)];
    if (q.onlyUid) c.unshift(where("enteredBy", "==", q.onlyUid));
    const qq = query(collection(fb().db, "cities", cityId, "expenses"), ...c, orderBy("date", "desc"));
    return onSnapshot(qq, (snap) =>
      cb(snap.docs.map((d) => ({ ...(d.data() as Expense), id: d.id, createdAt: iso(d.data().createdAt) ?? "" }))),
    );
  },
  async addExpense(cityId, e) {
    const r = await addDoc(collection(fb().db, "cities", cityId, "expenses"), { ...e, createdAt: serverTimestamp() });
    return r.id;
  },
  async updateExpense(cityId, id, patch) {
    const { id: _id, createdAt: _c, ...rest } = patch;
    await updateDoc(doc(fb().db, "cities", cityId, "expenses", id), { ...rest, updatedAt: serverTimestamp() });
  },
  async deleteExpense(cityId, id) {
    await deleteDoc(doc(fb().db, "cities", cityId, "expenses", id));
  },
  /** No Firebase Storage bucket in this project: receipts are stored inline as a
   * compressed base64 data URL (see compressReceipt in lib/image.ts). */
  async uploadReceipt(_cityId, _uid, file, _name) {
    return blobToDataUrl(file);
  },

  subscribeBudgets(cityId, months, cb) {
    return subscribeDocs<Budget>(months.map((m) => [m, `cities/${cityId}/budgets/${m}`]), cb);
  },
  async setBudget(cityId, month, b) {
    await setDoc(doc(fb().db, "cities", cityId, "budgets", month), b);
  },
  subscribeRevenue(cityId, months, cb) {
    return subscribeDocs<Revenue>(months.map((m) => [m, `cities/${cityId}/revenue/${m}`]), cb);
  },
  async setRevenue(cityId, month, r) {
    await setDoc(doc(fb().db, "cities", cityId, "revenue", month), r);
  },

  subscribeMeterReadings(cityId, months, cb) {
    return subscribeDocs<MeterReading>(months.map((m) => [m, `cities/${cityId}/meterReadings/${m}`]), cb);
  },
  async setMeterReading(cityId, month, r) {
    await setDoc(doc(fb().db, "cities", cityId, "meterReadings", month), r);
  },

  subscribeConfig(cityId, cb) {
    return onSnapshot(doc(fb().db, "cities", cityId, "config", "general"), (s) =>
      cb({ ...DEFAULT_CONFIG, ...(s.data() ?? {}) }),
    );
  },
  async setConfig(cityId, c) {
    await setDoc(doc(fb().db, "cities", cityId, "config", "general"), c, { merge: true });
  },
};
