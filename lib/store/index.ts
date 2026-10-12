import { dataBackend } from "../env";
import { localStore } from "./local";
import { supabaseStore } from "./supabase";
import type { DataStore } from "./types";

export async function getData(): Promise<DataStore> {
  const backend = dataBackend();
  if (backend === "supabase") return supabaseStore;
  if (backend === "local") return localStore;
  throw new Error(
    "Price Ranger needs NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in production.",
  );
}
