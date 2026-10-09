import { invoke } from "@tauri-apps/api/core";
import type { AiDraft } from "@/types/AiDraft";
import type { AiStatus } from "@/types/AiStatus";

/** Typed wrappers for src-tauri/src/commands/ai.rs. All network work happens in Rust. */
export const aiApi = {
  status: () => invoke<AiStatus>("ai_status"),
  consent: (given: boolean) => invoke<null>("ai_consent", { given }),
  setKey: (key: string) => invoke<null>("ai_set_key", { key }),
  clearKey: () => invoke<null>("ai_clear_key"),
  /** `now` = local `YYYY-MM-DDTHH:mm`. */
  parseText: (text: string, now: string) => invoke<AiDraft>("ai_parse_text", { text, now }),
  openKeyPage: () => invoke<null>("ai_open_key_page"),
};
