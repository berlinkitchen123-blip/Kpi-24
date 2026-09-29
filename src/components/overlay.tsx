import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/format";

// ---- Toast --------------------------------------------------------------------------------
interface ToastMsg { id: number; text: string; action?: { label: string; run: () => void } }
const ToastCtx = createContext<(text: string, action?: ToastMsg["action"]) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState<ToastMsg | null>(null);
  const timer = useRef<number>(0);
  const show = useCallback((text: string, action?: ToastMsg["action"]) => {
    window.clearTimeout(timer.current);
    setMsg({ id: Date.now(), text, action });
    timer.current = window.setTimeout(() => setMsg(null), 6000);
  }, []);
  return (
    <ToastCtx.Provider value={show}>
      {children}
      {msg && (
        <div role="status" className="fixed bottom-20 left-1/2 z-50 flex max-w-[calc(100vw-32px)] -translate-x-1/2 items-center gap-3 rounded-lg bg-ink px-4 py-2.5 text-sm text-white shadow-lg lg:bottom-6">
          <span className="min-w-0 truncate">{msg.text}</span>
          {msg.action && (
            <button
              className="shrink-0 font-semibold text-emerald-300"
              onClick={() => {
                msg.action!.run();
                setMsg(null);
              }}
            >
              {msg.action.label}
            </button>
          )}
        </div>
      )}
    </ToastCtx.Provider>
  );
}
export const useToast = () => useContext(ToastCtx);

// ---- Drawer (right side on desktop, bottom sheet on phone) --------------------------------
export function Drawer({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40">
      <div className="absolute inset-0 bg-slate-900/30" onClick={onClose} />
      <div
        role="dialog"
        aria-label={title}
        className="absolute inset-x-0 bottom-0 max-h-[90vh] overflow-y-auto rounded-t-2xl bg-surface shadow-xl sm:inset-y-0 sm:left-auto sm:right-0 sm:max-h-none sm:w-[440px] sm:rounded-none"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-surface px-5 py-3">
          <h2 className="font-semibold">{title}</h2>
          <button onClick={onClose} className="rounded-md p-1.5 hover:bg-slate-100" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

// ---- Segmented control --------------------------------------------------------------------
export function Segmented<T extends string | number>({ value, options, onChange, label, className }: {
  value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label: string; className?: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className={cn("inline-flex rounded-lg bg-slate-100 p-0.5 text-sm", className)}>
      {options.map((o) => (
        <button
          type="button"
          role="radio"
          aria-checked={o.value === value}
          key={String(o.value)}
          onClick={() => onChange(o.value)}
          className={cn("flex-1 whitespace-nowrap rounded-md px-2 py-1.5 text-muted", o.value === value && "bg-surface font-medium text-ink shadow-sm")}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Labelled form field. Use `group` for button groups (a <label> would swallow the buttons' names). */
export function Field({ label, children, hint, group }: { label: string; children: ReactNode; hint?: ReactNode; group?: boolean }) {
  const inner = (
    <>
      <span className="mb-1 block text-xs font-medium text-muted">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-muted">{hint}</span>}
    </>
  );
  return group ? <div role="group" aria-label={label} className="block">{inner}</div> : <label className="block">{inner}</label>;
}
