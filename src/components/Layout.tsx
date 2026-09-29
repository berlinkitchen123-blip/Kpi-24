import { NavLink, Outlet } from "react-router-dom";
import { LogOut, MapPin } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { isDemo } from "@/lib/firebase/config";
import { cn } from "@/lib/format";
import { LIVE_PHASE, NAV } from "./nav";

const ROLE_LABEL = { manager: "City Manager", staff: "Staff / driver", management: "Management (read-only)" } as const;

export function Layout() {
  const { user, role, cities, cityId, setCityId, signOut } = useAuth();
  const items = NAV.filter((n) => role && n.roles.includes(role));
  const mobileItems = items.filter((n) => n.mobile);

  return (
    <div className="flex min-h-full">
      {/* Sidebar (desktop) */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-line bg-surface lg:flex">
        <div className="flex items-center gap-2.5 px-5 py-5">
          <Logo />
          <div className="leading-tight">
            <div className="text-sm font-semibold">City P&amp;L</div>
            <div className="text-[11px] text-muted">Control Center</div>
          </div>
        </div>
        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3">
          {items.map((n) => (
            <NavLink
              key={n.path}
              to={n.path}
              end={n.path === "/"}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-slate-600 hover:bg-slate-50 hover:text-ink",
                  isActive && "bg-slate-100 font-medium text-ink",
                )
              }
            >
              <n.icon className="h-4 w-4" />
              <span className="flex-1">{n.label}</span>
              {n.phase > LIVE_PHASE && <span className="text-[10px] text-slate-400">P{n.phase}</span>}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-line p-3">
          <div className="px-2 pb-2 text-xs">
            <div className="font-medium">{user?.name}</div>
            <div className="text-muted">{role ? ROLE_LABEL[role] : "No role"}</div>
          </div>
          <button onClick={signOut} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-muted hover:bg-slate-50">
            <LogOut className="h-3.5 w-3.5" /> Sign out
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar */}
        <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-line bg-surface/90 px-4 py-2.5 backdrop-blur lg:px-8">
          <div className="lg:hidden"><Logo /></div>
          <label className="flex items-center gap-1.5 text-sm">
            <MapPin className="h-4 w-4 text-brand" />
            <select
              value={cityId ?? ""}
              onChange={(e) => setCityId(e.target.value)}
              className="rounded-md bg-transparent py-1 pr-1 font-semibold outline-none"
              aria-label="City"
            >
              {cities.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}{c.active ? "" : " (setup)"}
                </option>
              ))}
            </select>
          </label>
          <div className="flex-1" />
          {isDemo && <span className="whitespace-nowrap rounded-md bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800">Demo data</span>}
          <span className="hidden text-xs text-muted sm:inline lg:hidden">{user?.name}</span>
          <button onClick={signOut} className="rounded-md p-1.5 text-muted hover:bg-slate-100 lg:hidden" aria-label="Sign out">
            <LogOut className="h-4 w-4" />
          </button>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-24 pt-5 lg:px-8 lg:pb-10">
          <Outlet />
        </main>

        {/* Bottom bar (mobile) */}
        <nav className="fixed inset-x-0 bottom-0 z-10 flex border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] lg:hidden">
          {mobileItems.map((n) => (
            <NavLink
              key={n.path}
              to={n.path}
              end={n.path === "/"}
              className={({ isActive }) =>
                cn("flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] text-muted", isActive && "text-brand")
              }
            >
              <n.icon className={cn("h-5 w-5", n.path === "/add" && "h-6 w-6")} />
              {n.label}
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  );
}

export function Logo() {
  return (
    <svg viewBox="0 0 64 64" className="h-8 w-8 shrink-0" aria-hidden>
      <rect width="64" height="64" rx="14" fill="#0f172a" />
      <path d="M16 44V28m10 16V20m10 24V32m10 12V24" stroke="#34d399" strokeWidth="6" strokeLinecap="round" />
    </svg>
  );
}
