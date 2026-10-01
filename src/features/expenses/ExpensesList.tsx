import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { AlertTriangle, ArrowDown, ArrowUp, Check, Download, Paperclip, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { Badge, Button, Card, Input } from "@/components/ui";
import { Drawer, useToast } from "@/components/overlay";
import { MonthPicker } from "@/components/MonthPicker";
import { useAuth, usePermissions } from "@/hooks/useAuth";
import { useAllExpenses } from "@/hooks/useLive";
import { data } from "@/lib/data";
import { cn, currentMonth, fmtDate, fmtEur } from "@/lib/format";
import { netOf } from "@/lib/expenseNotes";
import { expensesToGermanCsv } from "@/lib/expenseCsv";
import { monthRange } from "@/lib/kpi";
import { EXPENSE_CATEGORIES, type Expense } from "@/types";
import { catLabel, ExpenseForm, vehicleLabel } from "./ExpenseForm";

type SortKey = "date" | "amount" | "supplier" | "category" | "vat" | "netto";

export function ExpensesList() {
  const [params, setParams] = useSearchParams();
  const month = params.get("month") ?? currentMonth();
  const category = params.get("category") ?? "";
  const type = params.get("type") ?? "";
  const vat = params.get("vat") ?? "";
  const supplier = params.get("supplier") ?? "";
  const q = params.get("q") ?? "";
  const missing = params.get("missing") === "1";
  const pending = params.get("pending") === "1";
  const set = (k: string, v: string) => setMany({ [k]: v });

  // React Router's setSearchParams always builds the next URL from the
  // searchParams captured in *this render's* closure — even the functional
  // updater form — so two separate `set()` calls in the same handler (e.g.
  // the category select setting both "category" and "type") each start from
  // the same stale snapshot and the second call silently clobbers the first.
  // Any handler that needs to change more than one param at once must go
  // through a single setParams call, hence this batched helper.
  const setMany = (patch: Record<string, string>) => {
    setParams(
      (prev) => {
        const p = new URLSearchParams(prev);
        for (const [k, v] of Object.entries(patch)) {
          if (v) p.set(k, v);
          else p.delete(k);
        }
        return p;
      },
      { replace: true },
    );
  };

  const { from, to } = monthRange(month);
  // One stable live subscription for the whole history (see useAllExpenses);
  // the month is then just a client-side filter, same as category/supplier/etc.,
  // so switching months is instant instead of re-opening a Firestore listener.
  const everything = useAllExpenses();
  const all = useMemo(
    () => (everything === null ? null : everything.filter((e) => e.date >= from && e.date <= to)),
    [everything, from, to],
  );
  const { isManager } = usePermissions();
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "date", dir: -1 });
  const [openId, setOpenId] = useState<string | null>(null);

  // Suppliers in this month, sorted by brutto spend desc, with line counts — for the filter dropdown.
  const supplierOptions = useMemo(() => {
    const m = new Map<string, { total: number; count: number }>();
    for (const e of all ?? []) {
      const s = m.get(e.supplier) ?? { total: 0, count: 0 };
      s.total += e.amount;
      s.count += 1;
      m.set(e.supplier, s);
    }
    return [...m.entries()].sort((a, b) => b[1].total - a[1].total);
  }, [all]);

  const typeDisabled = !!category && category !== "nonfood";
  const typeOptions = useMemo(() => EXPENSE_CATEGORIES.find((c) => c.id === "nonfood")!.subs, []);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (all ?? []).filter(
      (e) =>
        (!category || e.category === category) &&
        (!type || e.subcategory === type) &&
        (!vat || String(e.vatRate) === vat) &&
        (!supplier || e.supplier === supplier) &&
        (!missing || !e.receiptUrl) &&
        (!pending || e.status === "pending") &&
        (!needle || `${e.supplier} ${e.note} ${e.subcategory} ${e.enteredByName}`.toLowerCase().includes(needle)),
    );
  }, [all, category, type, vat, supplier, missing, pending, q]);

  const sortValue = (e: Expense, k: SortKey): number | string => {
    switch (k) {
      case "amount":
        return e.amount;
      case "vat":
        return e.vatRate;
      case "netto":
        return netOf(e.amount, e.vatRate);
      case "category":
        return `${catLabel(e.category)} ${e.subcategory}`;
      default:
        return e[k];
    }
  };
  const rows = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const av = sortValue(a, sort.key);
      const bv = sortValue(b, sort.key);
      const cmp = typeof av === "number" && typeof bv === "number" ? av - bv : String(av).localeCompare(String(bv));
      return cmp * sort.dir;
    });
  }, [filtered, sort]);

  const anyFilterActive = !!(category || type || vat || supplier || missing || pending || q);
  const sums = (list: Expense[]) =>
    list.reduce(
      (s, e) => {
        const net = netOf(e.amount, e.vatRate);
        s.net += net;
        s.gross += e.amount;
        s.vat += e.amount - net;
        return s;
      },
      { net: 0, vat: 0, gross: 0 },
    );
  const totals = sums(rows);
  const unfilteredTotals = sums(all ?? []);

  const missingCount = (all ?? []).filter((e) => !e.receiptUrl).length;
  const pendingCount = (all ?? []).filter((e) => e.status === "pending").length;
  const open = (all ?? []).find((e) => e.id === openId) ?? null;
  const suppliers = useMemo(() => [...new Set((all ?? []).map((e) => e.supplier))].sort(), [all]);

  const exportCsv = () => {
    const csv = expensesToGermanCsv(rows, catLabel);
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `ausgaben_remscheid_${month}${anyFilterActive ? "_gefiltert" : ""}.csv`;
    a.click();
  };

  // Text columns default to ascending (A→Z) on first click; numeric columns
  // default to descending (highest first), matching how Brutto already behaved.
  const textSortKeys: SortKey[] = ["supplier", "category"];
  const sortBtn = (key: SortKey, label: string, right = false) => (
    <button
      onClick={() => setSort((s) => ({ key, dir: s.key === key ? (s.dir === 1 ? -1 : 1) : textSortKeys.includes(key) ? 1 : -1 }))}
      className={cn("inline-flex items-center gap-1 font-medium", right && "flex-row-reverse")}
    >
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
        <select value={category} onChange={(e) => setMany({ category: e.target.value, ...(e.target.value !== "nonfood" ? { type: "" } : {}) })} className="h-9 rounded-lg border border-line bg-surface px-2 text-sm" aria-label="Category filter">
          <option value="">All categories</option>
          {EXPENSE_CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
        <select value={type} disabled={typeDisabled} onChange={(e) => set("type", e.target.value)} className="h-9 rounded-lg border border-line bg-surface px-2 text-sm disabled:opacity-40" aria-label="Type filter">
          <option value="">All types</option>
          {typeOptions.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={vat} onChange={(e) => set("vat", e.target.value)} className="h-9 rounded-lg border border-line bg-surface px-2 text-sm" aria-label="VAT filter">
          <option value="">All VAT rates</option>
          <option value="19">19 %</option>
          <option value="7">7 %</option>
          <option value="0">0 %</option>
        </select>
        <select value={supplier} onChange={(e) => set("supplier", e.target.value)} className="h-9 max-w-56 rounded-lg border border-line bg-surface px-2 text-sm" aria-label="Supplier filter">
          <option value="">All suppliers</option>
          {supplierOptions.map(([s, info]) => <option key={s} value={s}>{s} ({info.count})</option>)}
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

      <Card className="flex flex-wrap items-baseline gap-x-5 gap-y-1 px-4 py-2.5 text-sm">
        <span className="text-muted">{all === null ? "Loading…" : `${rows.length} entries`}</span>
        <span className="ml-auto flex flex-wrap items-baseline gap-x-5">
          <span className="text-muted">Netto <span className="tabular font-medium text-ink">{fmtEur(totals.net)}</span></span>
          <span className="text-muted">VAT <span className="tabular font-medium text-ink">{fmtEur(totals.vat)}</span></span>
          <span className="text-muted">Brutto <span className="tabular font-semibold text-ink">{fmtEur(totals.gross)}</span></span>
        </span>
        {anyFilterActive && all !== null && (
          <span className="w-full text-xs text-muted">filtered from {all.length} entries · Brutto {fmtEur(unfilteredTotals.gross)}</span>
        )}
      </Card>

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
                <th className="px-2 py-2.5">{sortBtn("category", "Category · Type")}</th>
                <th className="hidden px-2 py-2.5 text-right lg:table-cell">{sortBtn("vat", "VAT", true)}</th>
                <th className="hidden px-2 py-2.5 text-right lg:table-cell">{sortBtn("netto", "Netto", true)}</th>
                <th className="px-4 py-2.5 text-right">{sortBtn("amount", "Brutto", true)}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((e) => {
                const net = netOf(e.amount, e.vatRate);
                return (
                  <tr key={e.id} onClick={() => setOpenId(e.id)} className="cursor-pointer hover:bg-slate-50">
                    <td className="tabular whitespace-nowrap px-4 py-2.5 align-top">{fmtDate(e.date)}</td>
                    <td className="px-2 py-2.5 align-top">
                      <div className="font-medium">{e.supplier}</div>
                      {e.note && <div className="max-w-64 truncate text-xs text-muted">{e.note}</div>}
                    </td>
                    <td className="px-2 py-2.5 align-top">
                      {catLabel(e.category)} <span className="text-xs text-muted">· {e.subcategory}{e.vehicleId ? ` · ${vehicleLabel(e.vehicleId)}` : ""}</span>
                      <div className="mt-0.5"><Flags e={e} /></div>
                    </td>
                    <td className="tabular hidden px-2 py-2.5 text-right align-top text-muted lg:table-cell">{e.vatRate} %</td>
                    <td className="tabular hidden px-2 py-2.5 text-right align-top text-muted lg:table-cell">{fmtEur(net)}</td>
                    <td className="px-4 py-2.5 text-right align-top">
                      <div className="tabular font-medium">{fmtEur(e.amount)}</div>
                      <div className="tabular text-xs text-muted lg:hidden">Netto {fmtEur(net)}</div>
                    </td>
                  </tr>
                );
              })}
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
                  <div className="text-right">
                    <div className="tabular text-sm font-semibold">{fmtEur(e.amount)}</div>
                    <div className="tabular text-[11px] text-muted">Netto {fmtEur(netOf(e.amount, e.vatRate))}</div>
                  </div>
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
            <Item k="VAT" v={`${e.vatRate} % (${fmtEur(e.amount - netOf(e.amount, e.vatRate))})`} />
            <Item k="Netto" v={fmtEur(netOf(e.amount, e.vatRate))} />
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
