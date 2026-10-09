import { useState } from "react";
import { useTranslation } from "react-i18next";
import { AreaDot } from "@/components/AreaDot";
import { OptionButton } from "@/components/ui/OptionButton";
import { Popover } from "@/components/ui/Popover";
import { AREA_COLORS } from "@/lib/api/areas";

/** "area.work" → the colour's plain name ("Blue"). */
function colorName(token: string, t: (key: string) => string) {
  return t(`settings.colors.${token.replace("area.", "")}`);
}

/** Picks one of the area colours (DESIGN_SYSTEM §3.3), shown as a dot and its name. */
export function AreaColorPicker({
  value,
  label,
  onChange,
}: {
  value: string;
  /** Accessible name, e.g. "Colour for Work". */
  label: string;
  onChange: (color: string) => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      label={label}
      trigger={
        <button
          type="button"
          aria-label={`${label}: ${colorName(value, t)}`}
          className="inline-flex h-9 items-center gap-2 rounded-full border border-border bg-surface-2 px-3 text-small hover:bg-surface-3"
        >
          <AreaDot color={value} />
          {colorName(value, t)}
        </button>
      }
    >
      {AREA_COLORS.map((color) => (
        <OptionButton
          key={color}
          selected={color === value}
          onClick={() => {
            onChange(color);
            setOpen(false);
          }}
        >
          <AreaDot color={color} />
          {colorName(color, t)}
        </OptionButton>
      ))}
    </Popover>
  );
}
