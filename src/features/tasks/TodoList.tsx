import { useEffect, useMemo, useState } from "react";
import { AlarmClock, Check, ChevronDown, ExternalLink, Mail, MessageSquare, PenLine, Plus, RefreshCw, RotateCcw } from "lucide-react";
import { Badge, Button, Card, Input } from "@/components/ui";
import { useAuth, usePermissions } from "@/hooks/useAuth";
import { useSync, useTasks } from "@/hooks/useLive";
import { data } from "@/lib/data";
import { demoTouchSync } from "@/lib/data/demoSource";
import { isDemo } from "@/lib/firebase/config";
import { cn, fmtAgo, fmtDue } from "@/lib/format";
import type { Task, TaskSource } from "@/types";

type Filter = "all" | TaskSource;

const SOURCE_ICON = { email: Mail, teams: MessageSquare, manual: PenLine } as const;
const PRIORITY_RANK = { high: 0, normal: 1, low: 2 } as const;

/** A snoozed task comes back as open once its snooze time has passed. */
const isVisibleOpen = (t: Task, now: number) =>
  t.status === "open" || (t.status === "snoozed" && !!t.snoozedUntil && new Date(t.snoozedUntil).getTime() <= now);

function snoozeTarget(kind: "tomorrow" | "3d" | "monday"): string {
  const d = new Date();
  if (kind === "tomorrow") d.setDate(d.getDate() + 1);
  if (kind === "3d") d.setDate(d.getDate() + 3);
  if (kind === "monday") d.setDate(d.getDate() + (((8 - d.getDay()) % 7) || 7));
  d.setHours(8, 0, 0, 0);
  return d.toISOString();
}

export function TodoList() {
  const { cityId } = useAuth();
  const { canManageTasks } = usePermissions();
  const tasks = useTasks(cityId);
  const sync = useSync();
  const [filter, setFilter] = useState<Filter>("all");
  const [showDone, setShowDone] = useState(false);
  const [undo, setUndo] = useState<{ task: Task; label: string } | null>(null);
  const [adding, setAdding] = useState(false);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (!undo) return;
    const t = setTimeout(() => setUndo(null), 6000);
    return () => clearTimeout(t);
  }, [undo]);

  const { open, snoozed, done, counts } = useMemo(() => {
    const all = tasks ?? [];
    const f = (t: Task) => filter === "all" || t.source === filter;
    const open = all
      .filter((t) => isVisibleOpen(t, now) && f(t))
      .sort(
        (a, b) =>
          (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999") || PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority],
      );
    const snoozed = all.filter((t) => t.status === "snoozed" && !isVisibleOpen(t, now) && f(t));
    const done = all.filter((t) => t.status === "done" && f(t));
    const openAll = all.filter((t) => isVisibleOpen(t, now));
    const counts = {
      all: openAll.length,
      email: openAll.filter((t) => t.source === "email").length,
      teams: openAll.filter((t) => t.source === "teams").length,
      manual: openAll.filter((t) => t.source === "manual").length,
    };
    return { open, snoozed, done, counts };
  }, [tasks, filter, now]);

  if (!cityId) return null;

  const act = async (t: Task, patch: Partial<Task>, label: string) => {
    await data.updateTask(cityId, t.id, patch);
    setUndo({ task: t, label });
  };
  const revert = async () => {
    if (!undo) return;
    const { task } = undo;
    await data.updateTask(cityId, task.id, { status: task.status, snoozedUntil: task.snoozedUntil });
    setUndo(null);
  };

  const overdue = open.filter((t) => fmtDue(t.dueDate).tone === "overdue").length;

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line px-4 py-3">
        <div className="flex items-baseline gap-2">
          <h2 className="text-base font-semibold">To-do</h2>
          <span className="tabular text-sm text-muted">{counts.all} open</span>
          {overdue > 0 && <Badge tone="red">{overdue} overdue</Badge>}
        </div>
        <div className="flex-1" />
        <SyncStatus lastSyncedAt={sync.lastSyncedAt} />
        {canManageTasks && (
          <Button size="sm" variant="outline" onClick={() => setAdding((v) => !v)}>
            <Plus className="h-3.5 w-3.5" /> Task
          </Button>
        )}
      </div>

      <div className="flex gap-1 border-b border-line px-3 py-2 text-xs">
        {(["all", "email", "teams", "manual"] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn("rounded-md px-2.5 py-1 text-muted hover:bg-slate-100", filter === f && "bg-slate-100 font-medium text-ink")}
          >
            {{ all: "All", email: "Email", teams: "Teams", manual: "Manual" }[f]} <span className="tabular text-slate-400">{counts[f]}</span>
          </button>
        ))}
      </div>

      {adding && <AddTask cityId={cityId} onClose={() => setAdding(false)} />}

      {tasks === null ? (
        <div className="space-y-2 p-4">{[0, 1, 2].map((i) => <div key={i} className="h-12 animate-pulse rounded-lg bg-slate-100" />)}</div>
      ) : open.length === 0 ? (
        <div className="px-4 py-10 text-center text-sm text-muted">Nothing open. Clear desk.</div>
      ) : (
        <ul className="divide-y divide-line">
          {open.map((t) => (
            <TaskRow key={t.id} task={t} canEdit={canManageTasks} onDone={() => act(t, { status: "done" }, "Marked done")} onSnooze={(k) => act(t, { status: "snoozed", snoozedUntil: snoozeTarget(k) }, "Snoozed")} />
          ))}
        </ul>
      )}

      {(snoozed.length > 0 || done.length > 0) && (
        <div className="border-t border-line">
          <button onClick={() => setShowDone((v) => !v)} className="flex w-full items-center gap-1.5 px-4 py-2.5 text-xs text-muted hover:bg-slate-50">
            <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", showDone && "rotate-180")} />
            {snoozed.length} snoozed · {done.length} done
          </button>
          {showDone && (
            <ul className="divide-y divide-line bg-slate-50/60">
              {[...snoozed, ...done].map((t) => (
                <li key={t.id} className="flex items-center gap-3 px-4 py-2 text-sm">
                  <span className={cn("flex-1 truncate", t.status === "done" && "text-muted line-through")}>{t.title}</span>
                  <span className="text-xs text-muted">
                    {t.status === "snoozed" && t.snoozedUntil
                      ? `until ${new Date(t.snoozedUntil).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}`
                      : "done"}
                  </span>
                  {canManageTasks && (
                    <Button size="sm" variant="ghost" onClick={() => data.updateTask(cityId, t.id, { status: "open", snoozedUntil: null })}>
                      <RotateCcw className="h-3.5 w-3.5" /> Reopen
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {undo && (
        <div className="fixed bottom-20 left-1/2 z-20 flex -translate-x-1/2 items-center gap-3 rounded-lg bg-ink px-4 py-2.5 text-sm text-white shadow-lg lg:bottom-6">
          {undo.label}: <span className="max-w-48 truncate text-slate-300">{undo.task.title}</span>
          <button onClick={revert} className="font-semibold text-emerald-300">Undo</button>
        </div>
      )}
    </Card>
  );
}

function TaskRow({ task: t, canEdit, onDone, onSnooze }: { task: Task; canEdit: boolean; onDone: () => void; onSnooze: (k: "tomorrow" | "3d" | "monday") => void }) {
  const [menu, setMenu] = useState(false);
  const due = fmtDue(t.dueDate);
  const Icon = SOURCE_ICON[t.source];
  return (
    <li className="group flex items-start gap-3 px-4 py-3">
      <button
        disabled={!canEdit}
        onClick={onDone}
        className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 border-slate-300 text-transparent hover:border-good hover:text-good"
        aria-label="Mark done"
      >
        <Check className="h-3 w-3" strokeWidth={3} />
      </button>
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
          <span className="text-sm font-medium leading-5">{t.title}</span>
          {t.priority === "high" && <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-bad" title="High priority" />}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
          <span className="inline-flex items-center gap-1"><Icon className="h-3 w-3" />{t.sender}</span>
          <Badge tone={due.tone === "overdue" ? "red" : due.tone === "today" ? "amber" : "neutral"}>{due.label}</Badge>
        </div>
      </div>
      <div className="relative flex shrink-0 items-center gap-0.5">
        {t.link && (
          <a href={t.link} target="_blank" rel="noreferrer" className="rounded-md p-1.5 text-muted hover:bg-slate-100 hover:text-ink" aria-label="Open original message">
            <ExternalLink className="h-4 w-4" />
          </a>
        )}
        {canEdit && (
          <button onClick={() => setMenu((v) => !v)} className="rounded-md p-1.5 text-muted hover:bg-slate-100 hover:text-ink" aria-label="Snooze">
            <AlarmClock className="h-4 w-4" />
          </button>
        )}
        {menu && (
          <div className="absolute right-0 top-9 z-10 w-40 overflow-hidden rounded-lg border border-line bg-surface py-1 text-sm shadow-lg" onMouseLeave={() => setMenu(false)}>
            {([["tomorrow", "Tomorrow 08:00"], ["3d", "In 3 days"], ["monday", "Next Monday"]] as const).map(([k, l]) => (
              <button key={k} onClick={() => { setMenu(false); onSnooze(k); }} className="block w-full px-3 py-1.5 text-left hover:bg-slate-50">{l}</button>
            ))}
          </div>
        )}
      </div>
    </li>
  );
}

function SyncStatus({ lastSyncedAt }: { lastSyncedAt: string | null }) {
  const stale = !lastSyncedAt || Date.now() - new Date(lastSyncedAt).getTime() > 90 * 60_000;
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted" title="Outlook + Teams sync, every 30 min, read-only">
      <span className={cn("h-1.5 w-1.5 rounded-full", lastSyncedAt ? (stale ? "bg-warn" : "bg-good") : "bg-slate-300")} />
      {lastSyncedAt ? `Mail & Teams synced ${fmtAgo(lastSyncedAt)}` : "Mail & Teams sync not set up"}
      {isDemo && (
        <button onClick={demoTouchSync} className="rounded p-0.5 hover:bg-slate-100" aria-label="Simulate sync">
          <RefreshCw className="h-3 w-3" />
        </button>
      )}
    </span>
  );
}

function AddTask({ cityId, onClose }: { cityId: string; onClose: () => void }) {
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");
  const [high, setHigh] = useState(false);
  const save = async () => {
    if (!title.trim()) return;
    await data.addTask(cityId, {
      title: title.trim(), source: "manual", sender: "Me", dueDate: due || null, priority: high ? "high" : "normal",
      link: null, status: "open", snoozedUntil: null,
    });
    onClose();
  };
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-line bg-slate-50 px-4 py-3">
      <Input autoFocus placeholder="What needs doing?" value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === "Enter" && save()} className="min-w-48 flex-1" />
      <Input type="date" value={due} onChange={(e) => setDue(e.target.value)} className="w-40" />
      <label className="flex items-center gap-1.5 text-xs"><input type="checkbox" checked={high} onChange={(e) => setHigh(e.target.checked)} /> High</label>
      <Button size="sm" onClick={save}>Add</Button>
      <Button size="sm" variant="ghost" onClick={onClose}>Cancel</Button>
    </div>
  );
}
