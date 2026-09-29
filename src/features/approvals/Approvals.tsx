import { useMemo } from "react";
import { Link } from "react-router-dom";
import { Check, Paperclip } from "lucide-react";
import { Badge, Button, Card } from "@/components/ui";
import { useToast } from "@/components/overlay";
import { useAuth } from "@/hooks/useAuth";
import { useConfig, useExpenses } from "@/hooks/useLive";
import { data } from "@/lib/data";
import { fmtDate, fmtEur, todayIso } from "@/lib/format";
import { catLabel, vehicleLabel } from "@/features/expenses/ExpenseForm";

export function Approvals() {
  const { cityId } = useAuth();
  const toast = useToast();
  const { approvalLimit } = useConfig();
  const from = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 120);
    return d.toISOString().slice(0, 10);
  }, []);
  const all = useExpenses(from, todayIso());
  const pending = (all ?? []).filter((e) => e.status === "pending");

  const approve = async (id: string) => {
    await data.updateExpense(cityId!, id, { status: "approved" });
    toast("Approved", { label: "Undo", run: () => data.updateExpense(cityId!, id, { status: "pending" }) });
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Approvals</h1>
        <p className="text-sm text-muted">Staff spend above {fmtEur(approvalLimit, true)} waits here. Limit is set in <Link to="/settings" className="text-brand underline">Settings</Link>.</p>
      </div>
      {all === null ? (
        <Card className="h-24 animate-pulse" />
      ) : pending.length === 0 ? (
        <Card className="p-10 text-center text-sm text-muted">Nothing waiting for approval.</Card>
      ) : (
        <Card className="overflow-hidden">
          <ul className="divide-y divide-line">
            {pending.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{e.supplier} <span className="tabular ml-1">{fmtEur(e.amount)}</span></div>
                  <div className="text-xs text-muted">
                    {fmtDate(e.date)} · {catLabel(e.category)} · {e.subcategory}{e.vehicleId ? ` · ${vehicleLabel(e.vehicleId)}` : ""} · by {e.enteredByName}
                    {e.note && ` · “${e.note}”`}
                  </div>
                </div>
                {e.receiptUrl ? (
                  <a href={e.receiptUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-brand hover:underline"><Paperclip className="h-3.5 w-3.5" /> Receipt</a>
                ) : (
                  <Badge tone="red">No receipt</Badge>
                )}
                <Button size="sm" variant="brand" onClick={() => approve(e.id)}><Check className="h-3.5 w-3.5" /> Approve</Button>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
