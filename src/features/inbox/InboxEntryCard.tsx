import { format, parseISO } from "date-fns";
import { ListPlus, Trash2 } from "lucide-react";
import { motion } from "motion/react";
import { useTranslation } from "react-i18next";
import { useInboxActions, useInboxImage } from "@/features/inbox/api";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import type { InboxEntry } from "@/types/InboxEntry";

/** One note or picture: "Make it a task" (one click, PRD R18) or delete (with Undo). */
export function InboxEntryCard({ entry }: { entry: InboxEntry }) {
  const { t } = useTranslation();
  const { process, remove } = useInboxActions();
  const image = useInboxImage(entry.id, entry.hasImage);

  return (
    <motion.li
      layout
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
      className="overflow-hidden"
    >
      <div className="flex flex-col gap-2 rounded-md border border-border bg-surface p-3">
        {entry.hasImage &&
          (image.data ? (
            <img
              src={image.data}
              alt={entry.text ?? t("inbox.pictureAlt")}
              className="max-h-48 self-start rounded-sm border border-border object-contain"
            />
          ) : (
            <div className="skeleton h-24 w-40 rounded-sm" />
          ))}
        {entry.text && <p className="line-clamp-4 text-body whitespace-pre-line">{entry.text}</p>}
        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-auto text-small text-text-muted">
            {t("inbox.added", { date: format(parseISO(entry.createdAt), "EEE d MMM") })}
          </span>
          <Button
            size="sm"
            variant="secondary"
            disabled={process.isPending}
            onClick={() => process.mutate(entry)}
          >
            <ListPlus aria-hidden="true" />
            {t("inbox.makeTask")}
          </Button>
          <IconButton
            icon={Trash2}
            label={t("inbox.delete")}
            onClick={() => remove.mutate(entry)}
          />
        </div>
      </div>
    </motion.li>
  );
}
