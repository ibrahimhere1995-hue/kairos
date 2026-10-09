import { useState } from "react";
import { Archive, ArchiveRestore, ArrowDown, ArrowUp } from "lucide-react";
import { useTranslation } from "react-i18next";
import { AreaColorPicker } from "@/features/settings/areas/AreaColorPicker";
import { useArchiveArea, useUpdateArea } from "@/features/settings/areas/api";
import { Button } from "@/components/ui/Button";
import { FieldError } from "@/components/ui/FieldError";
import { IconButton } from "@/components/ui/IconButton";
import { toErrorPayload } from "@/lib/api/errors";
import { cn } from "@/lib/utils";
import type { Area } from "@/types/Area";

/**
 * One life area: rename (saved when leaving the field), recolour, move up/down, archive.
 * Give it `key={area.name}` so the field resets when the saved name changes elsewhere.
 */
export function AreaRow({
  area,
  isFirst,
  isLast,
  onMove,
}: {
  area: Area;
  isFirst: boolean;
  isLast: boolean;
  onMove: (direction: -1 | 1) => void;
}) {
  const { t } = useTranslation();
  const update = useUpdateArea();
  const archive = useArchiveArea();
  const [name, setName] = useState(area.name);
  const [error, setError] = useState<string | null>(null);

  const save = async (next: { name?: string; color?: string }) => {
    setError(null);
    try {
      await update.mutateAsync({
        id: area.id,
        input: { name: next.name ?? area.name, color: next.color ?? area.color },
      });
    } catch (e) {
      setError(toErrorPayload(e).message);
    }
  };

  return (
    <li
      className={cn(
        "flex flex-wrap items-center gap-2 border-b border-border py-3 last:border-b-0",
        area.isArchived && "text-text-muted",
      )}
    >
      <div className="flex min-w-48 flex-1 flex-col gap-1">
        <input
          type="text"
          value={name}
          maxLength={40}
          aria-label={t("settings.areaName", { name: area.name })}
          aria-invalid={error !== null}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => {
            if (name.trim() !== area.name) void save({ name });
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
          }}
          className="h-9 rounded-sm border border-transparent bg-transparent px-2 text-body hover:border-border focus:border-border"
        />
        {error && <FieldError message={t(error)} />}
      </div>
      {area.isArchived && <span className="text-small">{t("settings.archived")}</span>}
      <AreaColorPicker
        value={area.color}
        label={t("settings.colorFor", { name: area.name })}
        onChange={(color) => void save({ color })}
      />
      <IconButton
        icon={ArrowUp}
        label={t("settings.moveUp", { name: area.name })}
        disabled={isFirst}
        onClick={() => onMove(-1)}
      />
      <IconButton
        icon={ArrowDown}
        label={t("settings.moveDown", { name: area.name })}
        disabled={isLast}
        onClick={() => onMove(1)}
      />
      <Button
        size="sm"
        variant="ghost"
        aria-label={t(area.isArchived ? "settings.unarchiveArea" : "settings.archiveArea", {
          name: area.name,
        })}
        onClick={() => archive.mutate({ id: area.id, archived: !area.isArchived })}
      >
        {area.isArchived ? <ArchiveRestore aria-hidden="true" /> : <Archive aria-hidden="true" />}
        {t(area.isArchived ? "settings.unarchive" : "settings.archive")}
      </Button>
    </li>
  );
}
