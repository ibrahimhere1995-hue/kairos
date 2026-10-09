import { useEffect } from "react";
import { useEditorStore } from "@/features/items/editorStore";
import { onNavigate, onOpenItem } from "@/lib/api/events";

/** Reacts to clicks on reminder notifications and the tray: open an item, or a screen. */
export function AppEventsListener({ navigate }: { navigate: (path: string) => void }) {
  useEffect(() => {
    const stops = [
      onOpenItem((id) => useEditorStore.getState().openItem(id)),
      onNavigate(navigate),
    ];
    return () => {
      for (const stop of stops) void stop.then((unlisten) => unlisten());
    };
  }, [navigate]);
  return null;
}
