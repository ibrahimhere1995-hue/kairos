import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  icon?: LucideIcon;
}

/** Labelled segmented control built on native radios (arrow keys, screen readers for free). */
export function SegmentedControl<T extends string>({
  name,
  legend,
  options,
  value,
  onChange,
}: {
  name: string;
  legend: string;
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <fieldset>
      <legend className="sr-only">{legend}</legend>
      <div className="inline-flex gap-1 rounded-md border border-border bg-surface-2 p-1">
        {options.map(({ value: optionValue, label, icon: Icon }) => (
          <label
            key={optionValue}
            className={cn(
              "inline-flex h-8 cursor-pointer items-center gap-2 rounded-sm px-3 text-small text-text-muted",
              "hover:bg-surface-3 hover:text-text",
              "has-[:checked]:bg-surface has-[:checked]:text-text has-[:checked]:shadow-sm",
              "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus-ring",
            )}
          >
            <input
              type="radio"
              name={name}
              value={optionValue}
              checked={value === optionValue}
              onChange={() => onChange(optionValue)}
              className="sr-only"
            />
            {Icon && <Icon aria-hidden="true" className="size-4" />}
            <span>{label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
