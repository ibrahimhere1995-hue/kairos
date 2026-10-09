import { useState, type FormEvent } from "react";
import { Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAreas } from "@/features/items/api";
import { AreaColorPicker } from "@/features/settings/areas/AreaColorPicker";
import { AreaRow } from "@/features/settings/areas/AreaRow";
import { moved, useCreateArea, useMoveArea } from "@/features/settings/areas/api";
import { Button } from "@/components/ui/Button";
import { FieldError } from "@/components/ui/FieldError";
import { AREA_COLORS } from "@/lib/api/areas";
import { toErrorPayload } from "@/lib/api/errors";

/** P2-T10: add, rename, recolour, reorder and archive life areas. */
export function AreasSettings() {
  const { t } = useTranslation();
  const { data: areas, isPending, isError, refetch } = useAreas();
  const create = useCreateArea();
  const move = useMoveArea();
  const [name, setName] = useState("");
  const [color, setColor] = useState<string>(AREA_COLORS[0]);
  const [error, setError] = useState<string | null>(null);

  const add = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    try {
      await create.mutateAsync({ name, color });
      setName("");
    } catch (e) {
      setError(toErrorPayload(e).message);
    }
  };

  const ids = areas?.map((a) => a.id) ?? [];

  return (
    <section aria-labelledby="areas-heading" className="flex flex-col gap-2">
      <h2 id="areas-heading" className="text-h2">
        {t("settings.areas")}
      </h2>
      <p className="text-small text-text-muted">{t("settings.areasHelp")}</p>

      {isPending ? (
        <div aria-busy="true" className="flex flex-col gap-2">
          <div className="skeleton h-10 rounded-sm" />
          <div className="skeleton h-10 rounded-sm" />
        </div>
      ) : isError ? (
        <div role="alert" className="flex items-center gap-3 text-body text-text-muted">
          {t("errors.database")}
          <Button size="sm" variant="secondary" onClick={() => void refetch()}>
            {t("common.tryAgain")}
          </Button>
        </div>
      ) : (
        <ul className="flex flex-col">
          {areas.map((area, index) => (
            <AreaRow
              key={`${area.id}:${area.name}`}
              area={area}
              isFirst={index === 0}
              isLast={index === areas.length - 1}
              onMove={(direction) => move.mutate(moved(ids, index, direction))}
            />
          ))}
        </ul>
      )}

      <form onSubmit={add} className="flex flex-wrap items-start gap-2 pt-2">
        <div className="flex min-w-48 flex-1 flex-col gap-1">
          <input
            type="text"
            value={name}
            maxLength={40}
            placeholder={t("settings.newAreaName")}
            aria-label={t("settings.newAreaName")}
            aria-invalid={error !== null}
            onChange={(e) => setName(e.target.value)}
            className="h-10 rounded-sm border border-border bg-surface-2 px-3 text-body text-text"
          />
          {error && <FieldError message={t(error)} />}
        </div>
        <AreaColorPicker
          value={color}
          label={t("settings.colorFor", { name: name.trim() || t("settings.newAreaName") })}
          onChange={setColor}
        />
        <Button type="submit" variant="secondary" disabled={create.isPending}>
          <Plus aria-hidden="true" />
          {t("settings.addArea")}
        </Button>
      </form>
    </section>
  );
}
