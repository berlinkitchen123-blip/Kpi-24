import { useEffect, useMemo, useState } from "react";
import { data } from "@/lib/data";
import { DEFAULT_CONFIG } from "@/lib/data/types";
import { computeKpi, lastMonths, monthRange } from "@/lib/kpi";
import type { Budget, CityConfig, Expense, KpiSnapshot, MeterReading, Revenue, SyncState, Task } from "@/types";
import { useAuth } from "./useAuth";

export function useTasks(cityId: string | null) {
  const [tasks, setTasks] = useState<Task[] | null>(null);
  useEffect(() => {
    if (!cityId) return;
    setTasks(null);
    return data.subscribeTasks(cityId, setTasks);
  }, [cityId]);
  return tasks;
}

export function useSync() {
  const [s, setS] = useState<SyncState>({ lastSyncedAt: null });
  useEffect(() => data.subscribeSync(setS), []);
  return s;
}

/** Expenses between two dates. Staff automatically get only their own. */
export function useExpenses(from: string, to: string) {
  const { cityId, role, user } = useAuth();
  const [e, setE] = useState<Expense[] | null>(null);
  const onlyUid = role === "staff" ? user?.uid : undefined;
  useEffect(() => {
    if (!cityId) return;
    setE(null);
    return data.subscribeExpenses(cityId, { from, to, onlyUid }, setE);
  }, [cityId, from, to, onlyUid]);
  return e;
}

export function useBudgets(months: string[]) {
  const { cityId } = useAuth();
  const key = months.join(",");
  const [b, setB] = useState<Record<string, Budget> | null>(null);
  useEffect(() => {
    if (!cityId) return;
    return data.subscribeBudgets(cityId, key.split(","), setB);
  }, [cityId, key]);
  return b;
}

export function useRevenue(months: string[]) {
  const { cityId } = useAuth();
  const key = months.join(",");
  const [r, setR] = useState<Record<string, Revenue> | null>(null);
  useEffect(() => {
    if (!cityId) return;
    return data.subscribeRevenue(cityId, key.split(","), setR);
  }, [cityId, key]);
  return r;
}

export function useMeterReadings(months: string[]) {
  const { cityId } = useAuth();
  const key = months.join(",");
  const [r, setR] = useState<Record<string, MeterReading> | null>(null);
  useEffect(() => {
    if (!cityId) return;
    return data.subscribeMeterReadings(cityId, key.split(","), setR);
  }, [cityId, key]);
  return r;
}

export function useConfig() {
  const { cityId } = useAuth();
  const [c, setC] = useState<CityConfig>(DEFAULT_CONFIG);
  useEffect(() => {
    if (!cityId) return;
    return data.subscribeConfig(cityId, setC);
  }, [cityId]);
  return c;
}

/** KPIs for a month, calculated live from expenses, budgets and revenue (6-month window). */
export function useMonthKpi(month: string): KpiSnapshot | undefined {
  const months = useMemo(() => lastMonths(month, 6), [month]);
  const expenses = useExpenses(monthRange(months[0]).from, monthRange(month).to);
  const budgets = useBudgets(months);
  const revenue = useRevenue(months);
  return useMemo(
    () => (expenses && budgets && revenue ? computeKpi(month, months, expenses, budgets, revenue) : undefined),
    [expenses, budgets, revenue, month, months],
  );
}
