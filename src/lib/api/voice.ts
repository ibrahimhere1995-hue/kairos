import { invoke } from "@tauri-apps/api/core";

/** Live text while speaking (emitted by src-tauri/src/voice.rs). */
export const VOICE_PARTIAL = "voice:partial";

/** Typed wrappers for src-tauri/src/commands/voice.rs (Windows speech recognition). */
export const voiceApi = {
  start: () => invoke<null>("voice_start"),
  /** The words heard ("" if nothing). */
  stop: () => invoke<string>("voice_stop"),
  /** Opens the Windows privacy page for `reason` ("privacy" or "microphone"). */
  openSettings: (reason: string) => invoke<null>("voice_open_settings", { reason }),
};
