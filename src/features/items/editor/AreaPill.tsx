import { useState } from "react";
import { Circle } from "lucide-react";
import { useFormContext, useWatch } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { useAreas } from "@/features/items/api";
import type { ItemFormValues } from "@/features/items/itemForm";
import { OptionButton } from "@/components/ui/OptionButton";
import { Pill } from "@/components/ui/Pill";
import { Popover } from "@/components/ui/Popover";
import { AreaDot } from "@/components/AreaDot";
import { areaColor } from "@/lib/api/areas";

export function AreaPill() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const { setValue, control } = useFormContext<ItemFormValues>();
  const areaId = useWatch({ control, name: "areaId" });
  const { data: areas = [] } = useAreas();
  const current = areas.find((a) => a.id === areaId) ?? null;
  // Archived areas aren't offered, but an item already in one keeps showing it.
  const choices = areas.filter((a) => !a.isArchived || a.id === areaId);

  const choose = (id: string | null) => {
    setValue("areaId", id, { shouldDirty: true });
    setOpen(false);
  };

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      label={t("editor.area")}
      trigger={
        <Pill
          icon={Circle}
          field={t("editor.area")}
          iconStyle={{ color: areaColor(current?.color), fill: areaColor(current?.color) }}
        >
          {current?.name ?? t("editor.noArea")}
        </Pill>
      }
    >
      <OptionButton selected={areaId === null} onClick={() => choose(null)}>
        <AreaDot color={null} />
        {t("editor.noArea")}
      </OptionButton>
      {choices.map((area) => (
        <OptionButton key={area.id} selected={area.id === areaId} onClick={() => choose(area.id)}>
          <AreaDot color={area.color} />
          <span className="truncate">{area.name}</span>
        </OptionButton>
      ))}
    </Popover>
  );
}
