import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { VirtualList } from "@/components/VirtualList";

const rows = Array.from({ length: 1000 }, (_, i) => `Row ${i + 1}`);

function renderList() {
  return render(
    <VirtualList
      items={rows}
      label="Many rows"
      rowHeightRem={4}
      heightRem={20}
      getKey={(row) => row}
      renderRow={(row, style) => (
        <li key={row} style={style}>
          {row}
        </li>
      )}
    />,
  );
}

describe("VirtualList", () => {
  it("renders only the rows in view, not all 1000", () => {
    renderList();
    const shown = screen.getAllByRole("listitem");
    expect(shown.length).toBeLessThan(30);
    expect(screen.getByText("Row 1")).toBeInTheDocument();
    expect(screen.queryByText("Row 500")).not.toBeInTheDocument();
  });

  it("shows later rows after scrolling", () => {
    renderList();
    const list = screen.getByRole("list", { name: "Many rows" });
    const scroller = list.parentElement;
    if (!scroller) throw new Error("no scroll box");
    // 1 rem = 16px in jsdom → each row is 64px; row 500 starts at 499 × 64.
    fireEvent.scroll(scroller, { target: { scrollTop: 499 * 64 } });
    expect(screen.getByText("Row 500")).toBeInTheDocument();
    expect(screen.queryByText("Row 1")).not.toBeInTheDocument();
  });
});
