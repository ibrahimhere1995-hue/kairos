import type { ParsedCapture } from "@/lib/nlp/parseCapture";

/** Words that suggest a moment the offline parser may have missed. */
const TIME_HINTS =
  /\b(?:birthday|anniversary|next|this|coming|weekend|tonight|morning|afternoon|evening|noon|midnight|fortnight|end of|start of|beginning of|days?|weeks?|months?|\d{1,2}(?:st|nd|rd|th))\b/i;
/** Relative reminders ("two days before") are beyond the offline parser. */
const RELATIVE = /\b(?:remind|before|after)\b/i;

/**
 * PRD A2: offer "Read with AI" only for sentences the offline parser was likely unsure
 * about. Short captures ("Call bank") never need it.
 */
export function looksUnsure(text: string, parsed: ParsedCapture): boolean {
  if (text.trim().split(/\s+/).length < 3) return false;
  if (RELATIVE.test(text)) return true;
  return parsed.date === null && TIME_HINTS.test(text);
}
