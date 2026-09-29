import { ChevronLeft, ChevronRight } from "lucide-react";
import { currentMonth } from "@/lib/format";
import { monthLabel, shiftMonth } from "@/lib/kpi";

export function MonthPicker({ value, onChange, allowFuture = false }: { value: string; onChange: (m: string) => void; allowFuture?: boolean }) {
  const atMax = !allowFuture && value >= currentMonth();
  return (
    <div className="inline-flex items-center rounded-lg border border-line bg-surface">
      <button className="p-2 hover:bg-slate-50" onClick={() => onChange(shiftMonth(value, -1))} aria-label="Previous month">
        <ChevronLeft className="h-4 w-4" />
      </button>
      <span className="min-w-32 text-center text-sm font-medium">{monthLabel(value, "long")}</span>
      <button className="p-2 hover:bg-slate-50 disabled:opacity-30" disabled={atMax} onClick={() => onChange(shiftMonth(value, 1))} aria-label="Next month">
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}
