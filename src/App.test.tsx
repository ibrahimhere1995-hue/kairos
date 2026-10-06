import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import App from "@/App";

describe("App", () => {
  it("boots into the app shell", async () => {
    render(<App />);
    expect(await screen.findByRole("main")).toBeInTheDocument();
  });
});
