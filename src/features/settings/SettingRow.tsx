import type { ReactNode } from "react";

/** One setting: a visible label and plain-language description beside its control. */
export function SettingRow({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-b border-border py-4 last:border-b-0">
      <div className="flex min-w-0 max-w-md flex-col gap-0.5">
        <span className="text-body font-semibold">{label}</span>
        {description && <span className="text-small text-text-muted">{description}</span>}
      </div>
      {children}
    </div>
  );
}
