import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export const cn = (...c: ClassValue[]) => twMerge(clsx(c));

const eur = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" });
const eur0 = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
export const fmtEur = (n: number, whole = false) => (whole ? eur0 : eur).format(n);
export const fmtPct = (n: number) => `${n.toLocaleString("de-DE", { maximumFractionDigits: 1 })} %`;

/** Plain German decimal, comma separator, no thousands grouping — for CSV cells Excel should sum. */
export const numDE = (n: number) => n.toFixed(2).replace(".", ",");
/** YYYY-MM-DD -> DD.MM.YYYY, for CSV cells opened in German Excel. */
export const dateDE = (d: string) => d.split("-").reverse().join(".");

// Local dates (not UTC) so late-evening entries land on the right day.
const p2 = (n: number) => String(n).padStart(2, "0");
export const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
};
export const currentMonth = () => todayIso().slice(0, 7);
export const fmtDate = (d: string) => new Date(d + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" });

export function fmtDue(d: string | null): { label: string; tone: "overdue" | "today" | "soon" | "later" | "none" } {
  if (!d) return { label: "No date", tone: "none" };
  const today = new Date(todayIso());
  const due = new Date(d);
  const diff = Math.round((due.getTime() - today.getTime()) / 86_400_000);
  if (diff < 0) return { label: `${-diff}d overdue`, tone: "overdue" };
  if (diff === 0) return { label: "Today", tone: "today" };
  if (diff === 1) return { label: "Tomorrow", tone: "soon" };
  if (diff <= 3) return { label: due.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" }), tone: "soon" };
  return { label: due.toLocaleDateString("en-GB", { day: "numeric", month: "short" }), tone: "later" };
}

export function fmtAgo(iso: string | null) {
  if (!iso) return "never";
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  return `${Math.round(h / 24)} d ago`;
}

/** Budget bar colour: green < 80 %, amber 80–99 %, red ≥ 100 %. */
export const budgetTone = (spent: number, budget: number) => {
  const r = budget > 0 ? spent / budget : 0;
  return r >= 1 ? "red" : r >= 0.8 ? "amber" : "green";
};
