import { useState } from "react";

/**
 * The name used in the greeting. Saves when leaving the field (or on Enter). Give it
 * `key={saved}` so it resets when the saved value changes elsewhere.
 */
export function NameInput({
  saved,
  label,
  placeholder,
  onSave,
}: {
  saved: string;
  label: string;
  placeholder?: string;
  onSave: (name: string) => void;
}) {
  const [name, setName] = useState(saved);
  return (
    <input
      type="text"
      value={name}
      maxLength={40}
      aria-label={label}
      placeholder={placeholder}
      onChange={(e) => setName(e.target.value)}
      onBlur={() => {
        if (name.trim() !== saved) onSave(name.trim());
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
      }}
      className="h-10 w-64 max-w-full rounded-sm border border-border bg-surface-2 px-3 text-body text-text"
    />
  );
}
