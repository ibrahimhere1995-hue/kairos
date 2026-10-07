import { CalendarDays, Circle, Clock, Flag, Repeat, X, type LucideIcon } from "lucide-react";
import { motion } from "motion/react";
import { useTranslation } from "react-i18next";
import type { ChipKind } from "@/lib/nlp/parseCapture";

const ICONS: Record<ChipKind, LucideIcon> = {
  date: CalendarDays,
  time: Clock,
  area: Circle,
  priority: Flag,
  repeat: Repeat,
};

/** A recognised part of the typed text. Removing it keeps those words in the title instead. */
export function CaptureChip({
  kind,
  label,
  index,
  onRemove,
}: {
  kind: ChipKind;
  label: string;
  index: number;
  onRemove: () => void;
}) {
  const { t } = useTranslation();
  const Icon = ICONS[kind];
  const field = t(`capture.chip.${kind}`);

  return (
    <motion.li
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.12, delay: index * 0.06 }}
      className="inline-flex h-8 items-center gap-1.5 rounded-full border border-border bg-surface-2 pr-1 pl-3 text-small"
    >
      <Icon aria-hidden="true" className="size-4 text-accent-text" />
      <span className="sr-only">{field}:</span> <span>{label}</span>
      <button
        type="button"
        onClick={onRemove}
        aria-label={t("capture.removeChip", { field, value: label })}
        className="flex size-6 items-center justify-center rounded-full text-text-muted hover:bg-surface-3 hover:text-text"
      >
        <X aria-hidden="true" className="size-3.5" />
      </button>
    </motion.li>
  );
}
