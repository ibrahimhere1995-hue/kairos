import { useState } from "react";
import { Flag } from "lucide-react";
import { useFormContext, useWatch } from "react-hook-form";
import { useTranslation } from "react-i18next";
import type { ItemFormValues } from "@/features/items/itemForm";
import { OptionButton } from "@/components/ui/OptionButton";
import { Pill } from "@/components/ui/Pill";
import { Popover } from "@/components/ui/Popover";

const LEVELS = [3, 2, 1, 0] as const;
const KEYS = ["priority.none", "priority.low", "priority.medium", "priority.high"] as const;

export function PriorityPill() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const { setValue, control } = useFormContext<ItemFormValues>();
  const priority = useWatch({ control, name: "priority" });

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      label={t("editor.priority")}
      trigger={
        <Pill icon={Flag} field={t("editor.priority")}>
          {t(KEYS[priority] ?? KEYS[0])}
        </Pill>
      }
    >
      {LEVELS.map((level) => (
        <OptionButton
          key={level}
          selected={priority === level}
          onClick={() => {
            setValue("priority", level, { shouldDirty: true });
            setOpen(false);
          }}
        >
          <Flag aria-hidden="true" className="size-4" />
          {t(KEYS[level])}
        </OptionButton>
      ))}
    </Popover>
  );
}
