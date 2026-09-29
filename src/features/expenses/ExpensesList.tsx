import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { AlertTriangle, ArrowDown, ArrowUp, Check, Download, Paperclip, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { Badge, Button, Card, Input } from "@/components/ui";
import { Drawer, useToast } from "@/components/overlay";
import { MonthPicker } from "@/components/MonthPicker";
import { useAuth, usePermissions } from "@/hooks/useAuth";
import { useExpenses } from "@/hooks/useLive";
import { data } from "@/lib/data";
import { cn, currentMonth, fmtDate, fmtEur } from "@/lib/format";
import { monthRange } from "@/lib/kpi";
import { EXPENSE_CATEGORIES, type Expense } from "@/types";
import { catLabel, ExpenseForm, vehicleLabel } from "./ExpenseForm";

type SortKey = "date" | "amount" | "supplier";

export function ExpensesList() {
  const [params, setParams] = useSearchParams();
  const month = params.get("month") ?? currentMonth();
  const category = params.get("category") ?? "";
  const q = params.get("q") ?? "";
  const missing = params.get("missing") === "1";
  const pending = params.get("pending") === "1";
  const set = (k: string, v: string) => {
    const p = new URLSearchParams(params);
    if (v) p.set(k, v);
    else p.delete(k);
    setParams(p, { replace: true });
  };

  const { from, to } = monthRange(month);
  const all = useExpenses(from, to);
  const { isManager } = usePermissions();
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "date", dir: -1 });
  const [openId, setOpenId] = useState<string | null>(null);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const r = (all ?? []).filter(
      (e) =>
        (!category || e.category === category) &&
        (!missing || !e.receiptUrl) &&
        (!pending || e.status === "pending") &&
        (!needle || `${e.supplier} ${e.note} ${e.subcategory} ${e.enteredByName}`.toLowerCase().includes(needle)),
    );
    const k = sort.key;
    return r.sort((a, b) => (k === "amount" ? a.amount - b.amount : a[k].localeCompare(b[k])) * sort.dir);
  }, [all, category, missing, pending, q, sort]);

  const total = rows.reduce((s, e) => s + e.amount, 0);
  const missingCount = (all ?? []).filter((e) => !e.receiptUrl).length;
  const pendingCount = (all ?? []).filter((e) => e.status === "pending").length;
  const open = (all ?? []).find((e) => e.id === openId) ?? null;
  const suppliers = useMemo(() => [...new Set((all ?? []).map((e) => e.supplier))].sort(), [all]);

  const exportCsv = () => {
    const head = ["date", "amount", "vat", "category", "type", "supplier", "payment", "vehicle", "status", "receipt", "entered_by", "note"];
    const lines = rows.map((e) =>
      [e.date, e.amount.toFixed(2), e.vatRate, catLabel(e.category), e.subcategory, e.supplier, e.paymentMethod, vehicleLabel(e.vehicleId), e.status, e.receiptUrl ? "yes" : "no", e.enteredByName, e.note]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(";"),
    );
    const blob = new Blob(["﻿" + [head.join(";"), ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `expenses-${month}.csv`;
    a.click();
  };

  const sortBtn = (key: SortKey, label: string, right = false) => (
    <button onClick={() => setSort((s) => ({ key, dir: s.key === key ? (s.dir === 1 ? -1 : 1) : key === "supplier" ? 1 : -1 }))} className={cn("inline-flex items-center gap-1 font-medium", right && "flex-row-reverse")}>
      {label}
      {sort.key === key && (sort.dir === 1 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
    </button>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="mr-auto text-xl font-semibold">Expenses</h1>
        <Button variant="outline" size="sm" onClick={exportCsv} disabled={!rows.length}><Download className="h-3.5 w-3.5" /> CSV</Button>
        <Link to="/add"><Button size="sm" variant="brand"><Plus className="h-3.5 w-3.5" /> Add</Button></Link>
      </div>

      <Card className="flex flex-wrap items-center gap-2 p-3">
        <MonthPicker value={month} onChange={(m) => set("month", m === currentMonth() ? "" : m)} />
        <select value={category} onChange={(e) => set("category", e.target.value)} className="h-9 rounded-lg border border-line bg-surface px-2 text-sm" aria-label="Category filter">
          <option value="">All categories</option>
          {EXPENSE_CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
        <div className="relative min-w-40 flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <Input value={q} onChange={(e) => set("q", e.target.value)} placeholder="Supplier, note, person…" className="pl-8" aria-label="Search" />
        </div>
        <Toggle on={missing} onClick={() => set("missing", missing ? "" : "1")}>
          <AlertTriangle className="h-3.5 w-3.5" /> Missing receipt {missingCount > 0 && <span className="tabular">{missingCount}</span>}
        </Toggle>
        <Toggle on={pending} onClick={() => set("pending", pending ? "" : "1")}>
          Pending {pendingCount > 0 && <span className="tabular">{pendingCount}</span>}
        </Toggle>
      </Card>

      <div className="flex items-baseline justify-between px-1 text-sm">
        <span className="text-muted">{all === null ? "Loading…" : `${rows.length} entries`}</span>
        <span className="tabular font-semibold">{fmtEur(total)}</span>
      </div>

      {all !== null && rows.length === 0 ? (
        <Card className="p-10 text-center text-sm text-muted">No expenses match these filters.</Card>
      ) : (
        <Card className="overflow-hidden">
          {/* Desktop table */}
          <table className="hidden w-full text-sm md:table">
            <thead className="border-b border-line bg-slate-50 text-left text-xs text-muted">
              <tr>
                <th className="px-4 py-2.5">{sortBtn("date", "Date")}</th>
                <th className="px-2 py-2.5">{sortBtn("supplier", "Supplier")}</th>
                <th className="px-2 py-2.5 font-medium">Category</th>
                <th className="px-2 py-2.5 font-medium">Paid</th>
                <th className="px-2 py-2.5 font-medium">By</th>
                <th className="px-2 py-2.5"></th>
                <th className="px-4 py-2.5 text-right">{sortBtn("amount", "Amount", true)}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((e) => (
                <tr key={e.id} onClick={() => setOpenId(e.id)} className="cursor-pointer hover:bg-slate-50">
                  <td className="tabular whitespace-nowrap px-4 py-2.5">{fmtDate(e.date)}</td>
                  <td className="px-2 py-2.5">
                    <div className="font-medium">{e.supplier}</div>
                    {e.note && <div className="max-w-64 truncate text-xs text-muted">{e.note}</div>}
                  </td>
                  <td className="px-2 py-2.5">{catLabel(e.category)} <span className="text-xs text-muted">· {e.subcategory}{e.vehicleId ? ` · ${vehicleLabel(e.vehicleId)}` : ""}</span></td>
                  <td className="px-2 py-2.5 capitalize text-muted">{e.paymentMethod}</td>
                  <td className="px-2 py-2.5 text-muted">{e.enteredByName}</td>
                  <td className="px-2 py-2.5"><Flags e={e} /></td>
                  <td className="tabular px-4 py-2.5 text-right font-medium">{fmtEur(e.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {/* Phone list */}
          <ul className="divide-y divide-line md:hidden">
            {rows.map((e) => (
              <li key={e.id}>
                <button onClick={() => setOpenId(e.id)} className="flex w-full items-center gap-3 px-4 py-3 text-left">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{e.supplier}</div>
                    <div className="text-xs text-muted">{fmtDate(e.date)} · {catLabel(e.category)}{e.vehicleId ? ` · ${vehicleLabel(e.vehicleId)}` : ""}</div>
                  </div>
                  <Flags e={e} />
                  <span className="tabular text-sm font-semibold">{fmtEur(e.amount)}</span>
                </button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <ExpenseDrawer expense={open} canEdit={isManager} suppliers={suppliers} onClose={() => setOpenId(null)} />
    </div>
  );
}

function Flags({ e }: { e: Expense }) {
  return (
    <span className="inline-flex gap-1">
      {e.status === "pending" && <Badge tone="amber">Pending</Badge>}
      {!e.receiptUrl && <Badge tone="red" title="Missing receipt"><Paperclip className="h-3 w-3" /> none</Badge>}
    </span>
  );
}

function Toggle({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} aria-pressed={on} className={cn("inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-sm", on ? "border-ink bg-ink text-white" : "border-line bg-surface hover:bg-slate-50")}>
      {children}
    </button>
  );
}

function ExpenseDrawer({ expense: e, canEdit, suppliers, onClose }: { expense: Expense | null; canEdit: boolean; suppliers: string[]; onClose: () => void }) {
  const { cityId } = useAuth();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const close = () => {
    setEditing(false);
    setConfirmDel(false);
    onClose();
  };
  if (!e) return <Drawer open={false} onClose={close} title="">{null}</Drawer>;

  return (
    <Drawer open onClose={close} title={editing ? "Edit expense" : "Expense"}>
      {editing ? (
        <ExpenseForm
          initial={e}
          suppliers={suppliers}
          submitLabel="Save changes"
          onSubmit={async (n) => {
            await data.updateExpense(cityId!, e.id, n);
            toast("Changes saved");
            setEditing(false);
          }}
        />
      ) : (
        <div className="space-y-4">
          <div>
            <div className="tabular text-3xl font-semibold">{fmtEur(e.amount)}</div>
            <div className="text-sm text-muted">{e.supplier} · {fmtDate(e.date)}</div>
          </div>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <Item k="Category" v={`${catLabel(e.category)} · ${e.subcategory}`} />
            <Item k="VAT" v={`${e.vatRate} % (${fmtEur(e.amount - e.amount / (1 + e.vatRate / 100))})`} />
            <Item k="Paid by" v={e.paymentMethod} />
            <Item k="Vehicle" v={vehicleLabel(e.vehicleId) || "–"} />
            <Item k="Entered by" v={e.enteredByName} />
            <Item k="Status" v={e.status === "pending" ? "Waiting for approval" : "Approved"} />
            {e.note && <div className="col-span-2"><Item k="Note" v={e.note} /></div>}
          </dl>
          <div className="rounded-lg border border-line p-3 text-sm">
            {e.receiptUrl ? (
              <a href={e.receiptUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-brand hover:underline"><Paperclip className="h-4 w-4" /> Open receipt</a>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-bad"><AlertTriangle className="h-4 w-4" /> No receipt attached{canEdit && " – use Edit to add one"}</span>
            )}
          </div>
          {canEdit && (
            <div className="flex flex-wrap gap-2 border-t border-line pt-4">
              {e.status === "pending" && (
                <Button variant="brand" onClick={async () => { await data.updateExpense(cityId!, e.id, { status: "approved" }); toast("Approved"); }}>
                  <Check className="h-4 w-4" /> Approve
                </Button>
              )}
              <Button variant="outline" onClick={() => setEditing(true)}><Pencil className="h-4 w-4" /> Edit</Button>
              {confirmDel ? (
                <Button
                  className="bg-bad hover:bg-red-700"
                  onClick={async () => {
                    const copy = { ...e };
                    await data.deleteExpense(cityId!, e.id);
                    close();
                    const { id: _i, createdAt: _c, ...rest } = copy;
                    toast("Expense deleted", { label: "Undo", run: () => data.addExpense(cityId!, rest) });
                  }}
                >
                  Confirm delete
                </Button>
              ) : (
                <Button variant="ghost" className="text-bad" onClick={() => setConfirmDel(true)}><Trash2 className="h-4 w-4" /> Delete</Button>
              )}
            </div>
          )}
        </div>
      )}
    </Drawer>
  );
}

const Item = ({ k, v }: { k: string; v: string }) => (
  <div>
    <dt className="text-xs text-muted">{k}</dt>
    <dd className="capitalize-first">{v}</dd>
  </div>
);
