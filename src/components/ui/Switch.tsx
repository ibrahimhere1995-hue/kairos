import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

/** On/off switch (`role="switch"`), with the state also written out as text. */
export function Switch({
  checked,
  label,
  onChange,
}: {
  checked: boolean;
  /** Accessible name, usually the setting's visible label. */
  label: string;
  onChange: (checked: boolean) => void;
}) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className="inline-flex items-center gap-2 rounded-full text-small text-text-muted"
    >
      <span
        aria-hidden="true"
        className={cn(
          "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors duration-(--dur-fast)",
          checked ? "border-accent bg-accent" : "border-border-strong bg-surface-3",
        )}
      >
        <span
          className={cn(
            "inline-block size-4 rounded-full shadow-sm transition-transform duration-(--dur-fast)",
            checked ? "translate-x-6 bg-on-accent" : "translate-x-1 bg-text-muted",
          )}
        />
      </span>
      <span aria-hidden="true">{t(checked ? "settings.on" : "settings.off")}</span>
    </button>
  );
}
