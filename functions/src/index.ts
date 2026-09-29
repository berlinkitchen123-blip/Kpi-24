import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { setGlobalOptions } from "firebase-functions/v2";
import { HttpsError, onCall } from "firebase-functions/v2/https";

initializeApp();
setGlobalOptions({ region: "europe-west3", maxInstances: 5 });

const ROLES = ["manager", "staff", "management"] as const;
type Role = (typeof ROLES)[number];

/**
 * Assign (or remove, with role = null) a user's role in one city.
 * Only a City Manager of that city may call it. Writes custom claims + users/{uid} + audit entry.
 */
export const setUserRole = onCall<{ email: string; cityId: string; role: Role | null }>(async (req) => {
  const caller = req.auth;
  const { email, cityId, role } = req.data ?? ({} as never);
  if (!caller) throw new HttpsError("unauthenticated", "Sign in first.");
  const callerRoles = (caller.token.roles ?? {}) as Record<string, Role>;
  if (callerRoles[cityId] !== "manager") throw new HttpsError("permission-denied", "Only the City Manager can assign roles.");
  if (typeof email !== "string" || !email.includes("@")) throw new HttpsError("invalid-argument", "Invalid email.");
  if (role !== null && !ROLES.includes(role)) throw new HttpsError("invalid-argument", "Invalid role.");

  const db = getFirestore();
  if (!(await db.doc(`cities/${cityId}`).get()).exists) throw new HttpsError("not-found", "Unknown city.");

  const auth = getAuth();
  const user = await auth.getUserByEmail(email).catch(() => auth.createUser({ email }));
  const roles = { ...((user.customClaims?.roles ?? {}) as Record<string, Role>) };
  if (role) roles[cityId] = role;
  else delete roles[cityId];
  if (user.uid === caller.uid && role !== "manager") throw new HttpsError("failed-precondition", "You cannot remove your own manager role.");

  await auth.setCustomUserClaims(user.uid, { ...user.customClaims, roles });
  await db.doc(`users/${user.uid}`).set({ email, name: user.displayName ?? email, roles }, { merge: true });
  await db.collection(`cities/${cityId}/audit`).add({
    at: FieldValue.serverTimestamp(), by: caller.uid, action: "setUserRole", target: email, after: role,
  });
  return { uid: user.uid, roles };
});

// Planned, one folder each (see repo structure):
//   recurring/   – post rent, lease, internet, insurance on schedule   (Phase 5)
//   alerts/      – 80 % / 100 % budget, temp-food spikes, receipts    (Phase 5)
//   month-close/ – lock month, generate report                         (Phase 5)
//   kpi-calc/    – write cities/{cityId}/kpi/{YYYY-MM} snapshots       (Phase 3)
