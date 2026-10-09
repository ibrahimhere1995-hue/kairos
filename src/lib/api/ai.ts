import { invoke } from "@tauri-apps/api/core";
import type { AiDraft } from "@/types/AiDraft";
import type { AiImageDraft } from "@/types/AiImageDraft";
import type { AiStatus } from "@/types/AiStatus";
import type { PlanProposal } from "@/types/PlanProposal";
import type { PlanRequest } from "@/types/PlanRequest";

/** Typed wrappers for src-tauri/src/commands/ai.rs. All network work happens in Rust. */
export const aiApi = {
  status: () => invoke<AiStatus>("ai_status"),
  consent: (given: boolean) => invoke<null>("ai_consent", { given }),
  setKey: (key: string) => invoke<null>("ai_set_key", { key }),
  clearKey: () => invoke<null>("ai_clear_key"),
  /** `now` = local `YYYY-MM-DDTHH:mm`. */
  parseText: (text: string, now: string) => invoke<AiDraft>("ai_parse_text", { text, now }),
  openKeyPage: () => invoke<null>("ai_open_key_page"),
  /** A1: a shrunk picture as raw bytes; its type and the local time go in headers. */
  extractFromImage: (bytes: Uint8Array, type: string, now: string) =>
    invoke<AiImageDraft>("ai_extract_from_image", bytes, {
      headers: { "x-image-type": type, "x-now": now },
    }),
  plan: (request: PlanRequest) => invoke<PlanProposal[]>("ai_plan", { request }),
};
