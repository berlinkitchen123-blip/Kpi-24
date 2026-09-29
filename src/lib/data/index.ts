import { isDemo } from "@/lib/firebase/config";
import { demoSource } from "./demoSource";
import { firebaseSource } from "./firebaseSource";
import type { DataSource } from "./types";

export const data: DataSource = isDemo ? demoSource : firebaseSource;
export type { DataSource } from "./types";
