import { isTauri } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";

/** System "choose files" window. Resolves to [] if the user cancels. */
export async function pickFiles(title: string): Promise<string[]> {
  if (!isTauri()) return [];
  const chosen = await open({ multiple: true, directory: false, title });
  if (chosen === null) return [];
  return Array.isArray(chosen) ? chosen : [chosen];
}

/** System "choose a file" window limited to some extensions. Null if cancelled. */
export async function pickFile(title: string, extensions: string[]): Promise<string | null> {
  if (!isTauri()) return null;
  const chosen = await open({
    multiple: false,
    directory: false,
    title,
    filters: [{ name: extensions.join(", ").toUpperCase(), extensions }],
  });
  return typeof chosen === "string" ? chosen : null;
}

/** System "save as" window. Null if cancelled. */
export async function pickSavePath(
  title: string,
  defaultName: string,
  extension: string,
): Promise<string | null> {
  if (!isTauri()) return null;
  return save({
    title,
    defaultPath: defaultName,
    filters: [{ name: extension.toUpperCase(), extensions: [extension] }],
  });
}
