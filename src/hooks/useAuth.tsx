import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  GoogleAuthProvider, onAuthStateChanged, signInAnonymously, signInWithEmailAndPassword, signInWithPopup,
  signOut as fbSignOut,
} from "firebase/auth";
import { fb, isDemo } from "@/lib/firebase/config";
import { data } from "@/lib/data";
import type { AppUser, City, CityRoles, Role } from "@/types";

export const DEMO_USERS: AppUser[] = [
  { uid: "demo-harsh", name: "Harsh", email: "harsh@example.com", roles: { essen: "manager", dortmund: "manager" } },
  { uid: "demo-driver", name: "Driver (Van 2)", email: "driver@example.com", roles: { essen: "staff" } },
  { uid: "demo-ceo", name: "Management", email: "ceo@example.com", roles: { essen: "management" } },
];

interface AuthCtx {
  user: AppUser | null;
  loading: boolean;
  cities: City[];
  cityId: string | null;
  role: Role | null;
  setCityId: (id: string) => void;
  signInEmail: (email: string, pw: string) => Promise<void>;
  signInGoogle: () => Promise<void>;
  signInDemo: (uid: string) => void;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(!isDemo);
  const [cities, setCities] = useState<City[]>([]);
  const [cityId, setCityId] = useState<string | null>(null);

  // No login screen: every visitor is auto-signed-in anonymously and treated as
  // City Manager of "essen". Single-user setup by request — see firestore.rules,
  // which grants manager access to any signed-in (incl. anonymous) user.
  useEffect(() => {
    if (isDemo) return;
    const { auth } = fb();
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) {
        await signInAnonymously(auth);
        return; // onAuthStateChanged fires again once the anonymous user is set.
      }
      const token = await u.getIdTokenResult(true);
      const claimRoles = (token.claims.roles ?? {}) as CityRoles;
      const roles: CityRoles = { essen: "manager", ...claimRoles };
      setUser({ uid: u.uid, name: u.displayName ?? u.email ?? "Harsh", email: u.email ?? "", roles });
      setLoading(false);
    });
    return unsub;
  }, []);

  // Load the cities this user has a role in, pick the first one.
  useEffect(() => {
    if (!user) {
      setCities([]);
      setCityId(null);
      return;
    }
    data.listCities(Object.keys(user.roles)).then((cs) => {
      setCities(cs);
      setCityId((cur) => (cur && cs.some((c) => c.id === cur) ? cur : cs[0]?.id ?? null));
    });
  }, [user]);

  const value = useMemo<AuthCtx>(
    () => ({
      user,
      loading,
      cities,
      cityId,
      role: user && cityId ? user.roles[cityId] ?? null : null,
      setCityId,
      signInEmail: async (email, pw) => {
        await signInWithEmailAndPassword(fb().auth, email, pw);
      },
      signInGoogle: async () => {
        await signInWithPopup(fb().auth, new GoogleAuthProvider());
      },
      signInDemo: (uid) => setUser(DEMO_USERS.find((u) => u.uid === uid) ?? null),
      signOut: async () => {
        if (isDemo) setUser(null);
        else await fbSignOut(fb().auth);
      },
    }),
    [user, loading, cities, cityId],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth outside AuthProvider");
  return v;
}

/** What each role may do in the current city. Mirrors firestore.rules. */
export function usePermissions() {
  const { role } = useAuth();
  return {
    isManager: role === "manager",
    canAddExpense: role === "manager" || role === "staff",
    canSeeDashboard: role === "manager" || role === "management",
    canManageTasks: role === "manager",
    readOnly: role === "management",
  };
}
