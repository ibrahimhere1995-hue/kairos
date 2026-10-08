import { Fragment, useState, type CSSProperties, type ReactNode } from "react";

/** Lists longer than this are windowed (PROJECT_RULES performance budget: > 200 rows). */
export const VIRTUALIZE_AFTER = 200;
const OVERSCAN = 6;

function remToPx(rem: number): number {
  const root = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
  return rem * root;
}

/**
 * Renders only the rows in view (plus a few either side) inside its own scroll box.
 * Rows have a fixed height; each row receives the absolute-position style it must apply.
 */
export function VirtualList<T>({
  items,
  rowHeightRem,
  heightRem,
  label,
  getKey,
  renderRow,
}: {
  items: T[];
  rowHeightRem: number;
  heightRem: number;
  label: string;
  getKey: (item: T) => string;
  renderRow: (item: T, style: CSSProperties, index: number) => ReactNode;
}) {
  const [scrollTop, setScrollTop] = useState(0);
  const rowPx = remToPx(rowHeightRem);
  const viewPx = remToPx(heightRem);
  const first = Math.max(0, Math.floor(scrollTop / rowPx) - OVERSCAN);
  const last = Math.min(items.length, Math.ceil((scrollTop + viewPx) / rowPx) + OVERSCAN);

  return (
    <div
      className="overflow-y-auto rounded-md"
      style={{ height: `${heightRem}rem` }}
      onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
    >
      <ul aria-label={label} className="relative" style={{ height: items.length * rowPx }}>
        {items.slice(first, last).map((item, offset) => {
          const index = first + offset;
          return (
            // Rows own their list-item semantics: `renderRow` returns the <li>.
            <Fragment key={getKey(item)}>
              {renderRow(
                item,
                {
                  position: "absolute",
                  top: index * rowPx,
                  left: 0,
                  right: 0,
                  height: rowPx,
                },
                index,
              )}
            </Fragment>
          );
        })}
      </ul>
    </div>
  );
}
