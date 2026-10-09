import { invoke } from "@tauri-apps/api/core";
import type { Attachment } from "@/types/Attachment";

/** Typed wrappers for src-tauri/src/commands/attachments.rs. */
export const attachmentsApi = {
  list: (itemId: string) => invoke<Attachment[]>("list_attachments", { itemId }),
  add: (itemId: string, files: string[]) =>
    invoke<Attachment[]>("add_attachments", { itemId, files }),
  remove: (id: string) => invoke<null>("remove_attachment", { id }),
  open: (id: string) => invoke<null>("open_attachment", { id }),
  reveal: (id: string) => invoke<null>("reveal_attachment", { id }),
};
