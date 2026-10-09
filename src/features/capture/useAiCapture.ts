import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
import { useAiReady } from "@/features/ai/api";
import { looksUnsure } from "@/features/capture/looksUnsure";
import { aiApi } from "@/lib/api/ai";
import type { ChipKind, ParsedCapture } from "@/lib/nlp/parseCapture";
import type { AiDraft } from "@/types/AiDraft";

/** The AI's reading of a sentence, merged over the offline one (area and priority stay). */
function fromDraft(draft: AiDraft, offline: ParsedCapture): ParsedCapture {
  const chips: ChipKind[] = [];
  if (draft.date) chips.push("date");
  if (draft.time) chips.push("time");
  if (offline.areaId) chips.push("area");
  if (offline.priority) chips.push("priority");
  return {
    ...offline,
    title: draft.title,
    date: draft.date,
    time: draft.time,
    durationMinutes: draft.durationMinutes,
    repeat: null,
    chips,
  };
}

/**
 * PRD A2: when smart features are on and the offline parser looks unsure, offer to read the
 * sentence with AI. The result is a draft shown as chips; typing again drops it.
 */
export function useAiCapture(text: string, offline: ParsedCapture) {
  const ready = useAiReady();
  const [result, setResult] = useState<{ text: string; draft: AiDraft } | null>(null);
  const read = useMutation({
    mutationFn: (sentence: string) =>
      aiApi.parseText(sentence, format(new Date(), "yyyy-MM-dd'T'HH:mm")),
    onSuccess: (draft, sentence) => setResult({ text: sentence, draft }),
  });
  const draft = result?.text === text ? result.draft : null;

  return {
    parsed: draft ? fromDraft(draft, offline) : offline,
    draft,
    canRead: ready && !draft && looksUnsure(text, offline),
    read,
    clear: () => setResult(null),
  };
}
