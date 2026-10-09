import { invoke } from "@tauri-apps/api/core";
import type { Feedback } from "@/types/Feedback";
import type { FeedbackInput } from "@/types/FeedbackInput";

export type FeedbackKind = "idea" | "frustration" | "bug";
export type FeedbackStatus = "open" | "planned" | "done";

/** Typed wrappers for src-tauri/src/commands/feedback.rs. */
export const feedbackApi = {
  list: () => invoke<Feedback[]>("list_feedback"),
  create: (input: FeedbackInput) => invoke<Feedback>("create_feedback", { input }),
  update: (id: string, input: FeedbackInput) => invoke<Feedback>("update_feedback", { id, input }),
  setStatus: (id: string, status: FeedbackStatus) =>
    invoke<Feedback>("set_feedback_status", { id, status }),
  setDeleted: (id: string, deleted: boolean) => invoke<null>("delete_feedback", { id, deleted }),
  exportTo: (path: string) => invoke<null>("export_feedback", { path }),
  email: () => invoke<null>("email_feedback"),
};
