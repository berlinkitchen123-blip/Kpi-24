import { useEffect, useMemo, useState } from "react";
import { Save, Loader2 } from "lucide-react";
import { Button, Card, Input } from "@/components/ui";
import { Field, useToast } from "@/components/overlay";
import { MonthPicker } from "@/components/MonthPicker";
import { useAuth, usePermissions } from "@/hooks/useAuth";
import { useMeterReadings } from "@/hooks/useLive";
import { data } from "@/lib/data";
import { currentMonth, todayIso } from "@/lib/format";
import { lastMonths, monthLabel } from "@/lib/kpi";
import { parseAmount } from "@/features/expenses/ExpenseForm";

const toStr = (n: number | undefined) => (n ? String(n).replace(".", ",") : "");

export function Utilities() {
  const { cityId, user } = useAuth();
  const { isManager } = usePermissions();
  const toast = useToast();
  const [month, setMonth] = useState(currentMonth());
  const history = useMemo(() => lastMonths(month, 6), [month]);
  const readings = useMeterReadings(history);
  const stored = readings?.[month];

  const [form, setForm] = useState({ electricity: "", water: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm({ electricity: toStr(stored?.electricityKwh), water: toStr(stored?.waterM3) });
  }, [month, JSON.stringify(stored)]); // eslint-disable-line react-hooks/exhaustive-deps

  const elValue = parseAmount(form.electricity || "0");
  const waValue = parseAmount(form.water || "0");
  const invalid = Number.isNaN(elValue) || Number.isNaN(waValue);

  const save = async () => {
    if (invalid) return toast("Check the numbers");
    setSaving(true);
    await data.setMeterReading(cityId!, month, {
      electricityKwh: elValue,
      waterM3: waValue,
      readAt: todayIso(),
      enteredBy: user?.uid ?? "",
      enteredByName: user?.name ?? "",
    });
    setSaving(false);
    toast(`Meter readings saved for ${month}`);
  };

  const sorted = [...history].reverse();

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="mr-auto text-xl font-semibold">Utilities</h1>
        <MonthPicker value={month} onChange={setMonth} />
      </div>

      <Card className="p-4">
        <h2 className="mb-3 text-sm font-semibold">Electricity &amp; water reading</h2>
        <p className="mb-3 text-xs text-muted">Record the meter reading on the 1st of the month so consumption can be tracked over time.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Electricity (kWh)">
            <Input aria-label="Electricity kWh" inputMode="decimal" disabled={!isManager} value={form.electricity} onChange={(e) => setForm((f) => ({ ...f, electricity: e.target.value }))} />
          </Field>
          <Field label="Water (m³)">
            <Input aria-label="Water m3" inputMode="decimal" disabled={!isManager} value={form.water} onChange={(e) => setForm((f) => ({ ...f, water: e.target.value }))} />
          </Field>
        </div>
        {isManager && (
          <Button size="sm" className="mt-4" onClick={save} disabled={invalid || saving}>
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Save reading
          </Button>
        )}
      </Card>

      <Card className="overflow-hidden">
        <div className="border-b border-line px-4 py-3">
          <h2 className="text-sm font-semibold">History</h2>
        </div>
        <ul className="divide-y divide-line">
          {sorted.map((m) => {
            const r = readings?.[m];
            return (
              <li key={m} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                <span className="flex-1 font-medium">{monthLabel(m, "long")}</span>
                <span className="tabular w-24 text-right text-muted">{r ? `${r.electricityKwh} kWh` : "—"}</span>
                <span className="tabular w-24 text-right text-muted">{r ? `${r.waterM3} m³` : "—"}</span>
              </li>
            );
          })}
        </ul>
      </Card>
    </div>
  );
}
