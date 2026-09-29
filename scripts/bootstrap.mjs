// One-time setup, run ON YOUR COMPUTER (never in CI, never in chat):
//
//   cd functions && npm install && cd ..
//   GOOGLE_APPLICATION_CREDENTIALS=/path/to/serviceAccountKey.json \
//     node scripts/bootstrap.mjs harsh@bellabona.com essen Essen
//
// Creates the city document and makes the given email City Manager of it.
// The service account key stays on your machine – it is git-ignored.

import { createRequire } from "node:module";
const require = createRequire(new URL("../functions/package.json", import.meta.url));
const { initializeApp, applicationDefault } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");

const [email, cityId = "essen", cityName = "Essen"] = process.argv.slice(2);
if (!email) {
  console.error("Usage: node scripts/bootstrap.mjs <email> [cityId] [cityName]");
  process.exit(1);
}

initializeApp({ credential: applicationDefault() });
const auth = getAuth();
const db = getFirestore();

const user = await auth.getUserByEmail(email).catch(() => auth.createUser({ email }));
const roles = { ...(user.customClaims?.roles ?? {}), [cityId]: "manager" };
await auth.setCustomUserClaims(user.uid, { ...user.customClaims, roles });

await db.doc(`cities/${cityId}`).set({ name: cityName, active: true }, { merge: true });
await db.doc(`users/${user.uid}`).set({ email, name: user.displayName ?? email, roles }, { merge: true });
await db.doc("system/sync").set({ lastSyncedAt: null }, { merge: true });
await db.collection(`cities/${cityId}/audit`).add({ at: FieldValue.serverTimestamp(), by: "bootstrap", action: "bootstrap", target: email });

console.log(`OK: ${email} (${user.uid}) is manager of ${cityName}. Sign out and in again to pick up the role.`);
