import { CalendarArrowDown, CalendarArrowUp, FileJson } from "lucide-react";
import { useTranslation } from "react-i18next";
import { SettingRow } from "@/features/settings/SettingRow";
import { useDataActions } from "@/features/settings/data/dataApi";
import { Button } from "@/components/ui/Button";

/** PRD R5: export all data to JSON and `.ics`; import `.ics` (one-way). */
export function DataSection() {
  const { t } = useTranslation();
  const { exportJson, exportIcs, importIcs } = useDataActions();
  return (
    <section aria-labelledby="data-heading" className="flex flex-col">
      <h2 id="data-heading" className="text-h2">
        {t("data.title")}
      </h2>
      <p className="text-small text-text-muted">{t("data.help")}</p>
      <SettingRow label={t("data.exportJson")} description={t("data.exportJsonHelp")}>
        <Button
          variant="secondary"
          disabled={exportJson.isPending}
          onClick={() => exportJson.mutate()}
        >
          <FileJson aria-hidden="true" />
          {t("data.exportJson")}
        </Button>
      </SettingRow>
      <SettingRow label={t("data.exportIcs")} description={t("data.exportIcsHelp")}>
        <Button
          variant="secondary"
          disabled={exportIcs.isPending}
          onClick={() => exportIcs.mutate()}
        >
          <CalendarArrowUp aria-hidden="true" />
          {t("data.exportIcs")}
        </Button>
      </SettingRow>
      <SettingRow label={t("data.importIcs")} description={t("data.importIcsHelp")}>
        <Button
          variant="secondary"
          disabled={importIcs.isPending}
          onClick={() => importIcs.mutate()}
        >
          <CalendarArrowDown aria-hidden="true" />
          {t("data.importIcs")}
        </Button>
      </SettingRow>
    </section>
  );
}
