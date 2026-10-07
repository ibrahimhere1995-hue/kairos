import { cn } from "@/lib/utils";

/**
 * Round gold checkbox (DESIGN_SYSTEM §8). Checking plays the signature animation:
 * gold fill from the centre, then the tick draws on.
 */
export function CompleteCheckbox({
  checked,
  label,
  onChange,
  disabled,
}: {
  checked: boolean;
  /** Accessible name, e.g. "Mark “Call bank” as done". */
  label: string;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative flex size-9 shrink-0 items-center justify-center rounded-full",
        "hover:bg-surface-3 disabled:opacity-50",
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "flex size-5 items-center justify-center rounded-full border-2",
          // Unchecked ring uses --text-subtle: ≥3:1 against surfaces (WCAG 1.4.11), unlike --border.
          checked ? "check-fill border-accent bg-accent text-on-accent" : "border-text-subtle",
        )}
      >
        {checked && (
          <svg viewBox="0 0 16 16" className="size-3.5" fill="none">
            <path
              className="check-draw"
              d="M3.5 8.5l3 3 6-7"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </span>
    </button>
  );
}
