import { useState } from "react";
import { getFunctions, httpsCallable } from "firebase/functions";
import { ShieldCheck } from "lucide-react";
import { Badge, Button, Card, Input } from "@/components/ui";
import { DEMO_USERS, useAuth } from "@/hooks/useAuth";
import { useConfig } from "@/hooks/useLive";
import { data } from "@/lib/data";
import { useToast } from "@/components/overlay";
import { useEffect } from "react";
import { fb, isDemo } from "@/lib/firebase/config";
import type { Role } from "@/types";

const ROLES: { id: Role; label: string; desc: string }[] = [
  { id: "manager", label: "City Manager", desc: "Full access, budgets, approvals" },
  { id: "staff", label: "Staff / driver", desc: "Add expenses, sees only own entries" },
  { id: "management", label: "Management", desc: "Read-only dashboard" },
];

export function Settings() {
  const { cities, cityId } = useAuth();
  const city = cities.find((c) => c.id === cityId);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("staff");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const config = useConfig();
  const toast = useToast();
  const [limit, setLimit] = useState(String(config.approvalLimit));
  useEffect(() => setLimit(String(config.approvalLimit)), [config.approvalLimit]);
  const saveLimit = async () => {
    const n = Number(limit.replace(",", "."));
    if (!Number.isFinite(n) || n < 0) return toast("Enter a valid amount");
    await data.setConfig(cityId!, { approvalLimit: n });
    toast(`Approval limit set to EUR ${n}`);
  };

  const assign = async () => {
    if (!email.includes("@") || !cityId) return setMsg("Enter a valid email.");
    setBusy(true);
    setMsg(null);
    try {
      if (isDemo) {
        setMsg(`Demo: ${email} would get "${role}" in ${city?.name}.`);
      } else {
        const fn = httpsCallable(getFunctions(fb().app, "europe-west3"), "setUserRole");
        await fn({ email, cityId, role });
        setMsg(`Done: ${email} is now ${role} in ${city?.name}. They need to sign in again.`);
      }
      setEmail("");
    } catch (e) {
      setMsg(`Failed: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-semibold">Settings &amp; Users</h1>

      <Card className="p-5">
        <h2 className="text-sm font-semibold">Cities</h2>
        <ul className="mt-3 divide-y divide-line text-sm">
          {cities.map((c) => (
            <li key={c.id} className="flex items-center justify-between py-2">
              <span>{c.name} <span className="text-xs text-muted">({c.id})</span></span>
              <Badge tone={c.active ? "green" : "neutral"}>{c.active ? "Active" : "Setup"}</Badge>
            </li>
          ))}
        </ul>
      </Card>

      <Card className="p-5">
        <h2 className="text-sm font-semibold">Approval limit</h2>
        <p className="mt-1 text-xs text-muted">Staff expenses above this amount wait for your approval.</p>
        <div className="mt-3 flex gap-2">
          <div className="relative w-36">
            <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-muted">€</span>
            <Input aria-label="Approval limit" inputMode="decimal" value={limit} onChange={(e) => setLimit(e.target.value)} className="pl-6" />
          </div>
          <Button onClick={saveLimit} disabled={limit === String(config.approvalLimit)}>Save</Button>
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="text-sm font-semibold">Give someone access to {city?.name}</h2>
        <p className="mt-1 text-xs text-muted">Roles are set per city and enforced by Firestore security rules, not just hidden in the UI.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Input placeholder="name@company.com" value={email} onChange={(e) => setEmail(e.target.value)} className="min-w-56 flex-1" />
          <select value={role} onChange={(e) => setRole(e.target.value as Role)} className="h-9 rounded-lg border border-line bg-surface px-2 text-sm">
            {ROLES.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
          </select>
          <Button onClick={assign} disabled={busy}>Assign</Button>
        </div>
        {msg && <p className="mt-2 text-xs">{msg}</p>}
        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          {ROLES.map((r) => (
            <div key={r.id} className="rounded-lg bg-slate-50 p-3 text-xs">
              <div className="flex items-center gap-1 font-medium"><ShieldCheck className="h-3.5 w-3.5 text-brand" />{r.label}</div>
              <div className="mt-0.5 text-muted">{r.desc}</div>
            </div>
          ))}
        </div>
      </Card>

      {isDemo && (
        <Card className="p-5">
          <h2 className="text-sm font-semibold">Demo users</h2>
          <ul className="mt-2 divide-y divide-line text-sm">
            {DEMO_USERS.map((u) => (
              <li key={u.uid} className="flex justify-between py-2">
                <span>{u.name}</span>
                <span className="text-xs text-muted">{Object.entries(u.roles).map(([c, r]) => `${c}: ${r}`).join(" · ")}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
