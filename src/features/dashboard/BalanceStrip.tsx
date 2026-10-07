import { useTranslation } from "react-i18next";
import type { AreaBalance } from "@/features/dashboard/balance";
import { friendlyDuration } from "@/features/items/editor/friendlyDate";
import { AreaDot } from "@/components/AreaDot";
import { areaColor } from "@/lib/api/areas";

/** Planned time per life area this week: a proportional bar plus a readable legend. */
export function BalanceStrip({ balance }: { balance: AreaBalance[] }) {
  const { t } = useTranslation();
  const total = balance.reduce((sum, b) => sum + b.minutes, 0);

  return (
    <section
      aria-labelledby="balance-heading"
      className="flex flex-col gap-2 rounded-md border border-border bg-surface p-4"
    >
      <h2 id="balance-heading" className="text-h3">
        {t("myDay.balanceTitle")}
      </h2>
      {total === 0 ? (
        <p className="text-small text-text-muted">{t("myDay.balanceEmpty")}</p>
      ) : (
        <>
          <div aria-hidden="true" className="flex h-2 overflow-hidden rounded-full bg-surface-3">
            {balance
              .filter((b) => b.minutes > 0)
              .map((b) => (
                <span
                  key={b.areaId}
                  style={{
                    width: `${(b.minutes / total) * 100}%`,
                    backgroundColor: areaColor(b.color),
                  }}
                />
              ))}
          </div>
          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-small text-text-muted">
            {balance.map((b) => (
              <li key={b.areaId} className="inline-flex items-center gap-1.5">
                <AreaDot color={b.color} />
                <span>
                  {b.name}:{" "}
                  {b.minutes > 0 ? friendlyDuration(b.minutes, t) : t("dates.hours", { count: 0 })}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
