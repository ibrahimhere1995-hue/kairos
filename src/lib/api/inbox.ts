import { invoke } from "@tauri-apps/api/core";
import type { InboxEntry } from "@/types/InboxEntry";
import type { Item } from "@/types/Item";

/** Typed wrappers for the Inbox commands (src-tauri/src/commands/inbox_habits.rs). */
export const inboxApi = {
  list: () => invoke<InboxEntry[]>("list_inbox"),
  addText: (text: string) => invoke<InboxEntry>("add_inbox_text", { text }),
  /** A pasted picture, sent as raw bytes (no JSON) with its type in a header. */
  addImage: (bytes: Uint8Array, type: string) =>
    invoke<InboxEntry>("add_inbox_image", bytes, { headers: { "x-image-type": type } }),
  addImageFile: (path: string) => invoke<InboxEntry>("add_inbox_image_file", { path }),
  image: (id: string) => invoke<string>("inbox_image", { id }),
  process: (id: string) => invoke<Item>("process_inbox_entry", { id }),
  setDeleted: (id: string, deleted: boolean) => invoke<null>("delete_inbox_entry", { id, deleted }),
};
