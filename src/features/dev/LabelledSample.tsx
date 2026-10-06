import type { LucideIcon } from "lucide-react";

/** A status or area sample: colour + icon + text label together, never colour alone. */
export function LabelledSample({
  token,
  icon: Icon,
  label,
}: {
  token: string;
  icon: LucideIcon;
  label: string;
}) {
  return (
    <li
      className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-small"
      style={{ color: `var(${token})` }}
    >
      <Icon aria-hidden="true" className="size-4" />
      <span className="text-text">{label}</span>
    </li>
  );
}
