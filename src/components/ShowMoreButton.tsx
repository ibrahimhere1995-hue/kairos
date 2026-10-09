import { ChevronDown } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/Button";

/**
 * For long lists whose rows vary in height (so they can't use VirtualList): show a first
 * batch and add more on request, so the screen never builds thousands of rows at once.
 */
export function ShowMoreButton({
  hidden,
  label,
  onMore,
}: {
  /** How many are not shown yet. */
  hidden: number;
  /** Already translated, e.g. "Show 50 more". */
  label: string;
  onMore: () => void;
}) {
  const { t } = useTranslation();
  if (hidden <= 0) return null;
  return (
    <Button variant="ghost" size="sm" className="self-start" onClick={onMore}>
      <ChevronDown aria-hidden="true" />
      {label} <span className="text-text-muted">{t("common.notShown", { count: hidden })}</span>
    </Button>
  );
}
