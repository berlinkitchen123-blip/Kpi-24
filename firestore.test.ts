/**
 * Firestore Security Rules Tests
 *
 * Tests that:
 * 1. harsh@bellabona.com (email-verified) → manager on "remscheid"
 * 2. Any other signed-in user → no access to "remscheid"
 *
 * Run with: npx firebase emulators:exec --only firestore "npx jest tests/firestore.test.ts"
 * Or: npx firebase emulators:start --only firestore (then run jest separately)
 */

import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { readFileSync } from "fs";
import { collection, getDocs, addDoc } from "firebase/firestore";

let testEnv: RulesTestEnvironment;

const RULES = readFileSync("firestore.rules", "utf8");

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: "kpi-24-test",
    firestore: { rules: RULES, host: "localhost", port: 8080 },
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

afterEach(async () => {
  await testEnv.clearFirestore();
});

// --- helpers ---

function allowedUser() {
  return testEnv.authenticatedContext("uid-harsh", {
    email: "harsh@bellabona.com",
    email_verified: true,
  });
}

function otherUser() {
  return testEnv.authenticatedContext("uid-other", {
    email: "other@example.com",
    email_verified: true,
  });
}

function otherUserNotVerified() {
  return testEnv.authenticatedContext("uid-nv", {
    email: "harsh@bellabona.com",
    email_verified: false, // same email, but NOT verified
  });
}

// --- tests ---

describe("roleIn fallback — allowed email", () => {
  it("harsh@bellabona.com (email_verified=true) can read remscheid expenses", async () => {
    const ctx = allowedUser();
    const ref = collection(ctx.firestore(), "cities/remscheid/expenses");
    await assertSucceeds(getDocs(ref));
  });

  it("harsh@bellabona.com can create a pending expense in remscheid", async () => {
    const ctx = allowedUser();
    const ref = collection(ctx.firestore(), "cities/remscheid/expenses");
    await assertSucceeds(
      addDoc(ref, {
        cityId: "remscheid",
        date: "2026-11-01",
        amount: 100,
        vatRate: 19,
        category: "nonfood",
        subcategory: "cleaning",
        supplier: "Test GmbH",
        paymentMethod: "cash",
        receiptUrl: null,
        enteredBy: "uid-harsh",
        enteredByName: "Harsh",
        status: "pending",
        note: "",
        createdAt: new Date().toISOString(),
      })
    );
  });
});

describe("roleIn fallback — same email, NOT verified", () => {
  it("harsh@bellabona.com with email_verified=false → no access", async () => {
    const ctx = otherUserNotVerified();
    const ref = collection(ctx.firestore(), "cities/remscheid/expenses");
    await assertFails(getDocs(ref));
  });
});

describe("roleIn fallback — other signed-in user", () => {
  it("other@example.com → cannot read remscheid expenses", async () => {
    const ctx = otherUser();
    const ref = collection(ctx.firestore(), "cities/remscheid/expenses");
    await assertFails(getDocs(ref));
  });

  it("other@example.com → cannot create remscheid expense", async () => {
    const ctx = otherUser();
    const ref = collection(ctx.firestore(), "cities/remscheid/expenses");
    await assertFails(
      addDoc(ref, {
        cityId: "remscheid",
        date: "2026-11-01",
        amount: 50,
        vatRate: 7,
        category: "tempfood",
        subcategory: "meat",
        supplier: "Hacker GmbH",
        paymentMethod: "cash",
        receiptUrl: null,
        enteredBy: "uid-other",
        enteredByName: "Hacker",
        status: "pending",
        note: "",
        createdAt: new Date().toISOString(),
      })
    );
  });
});

describe("roleIn — custom claims still take priority", () => {
  it("user with custom claim role for a different city can access that city", async () => {
    const ctx = testEnv.authenticatedContext("uid-claim-user", {
      email: "staff@othercity.com",
      email_verified: true,
      roles: { berlin: "manager" },
    });
    const ref = collection(ctx.firestore(), "cities/berlin/expenses");
    await assertSucceeds(getDocs(ref));
  });

  it("user with custom claim role for berlin cannot access remscheid", async () => {
    const ctx = testEnv.authenticatedContext("uid-claim-user", {
      email: "staff@othercity.com",
      email_verified: true,
      roles: { berlin: "manager" },
    });
    const ref = collection(ctx.firestore(), "cities/remscheid/expenses");
    await assertFails(getDocs(ref));
  });
});
