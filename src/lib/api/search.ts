import { invoke } from "@tauri-apps/api/core";
import type { SearchHit } from "@/types/SearchHit";

/** Typed wrapper for the `search` command (titles, notes, steps, area names). */
export const searchApi = {
  search: (query: string) => invoke<SearchHit[]>("search", { query }),
};
