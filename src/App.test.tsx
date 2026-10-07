import { clearMocks } from "@tauri-apps/api/mocks";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import App from "@/App";
import { mockBackend } from "@/test/mockBackend";

afterEach(() => clearMocks());

describe("App", () => {
  it("boots into the app shell", async () => {
    mockBackend();
    render(<App />);
    expect(await screen.findByRole("main")).toBeInTheDocument();
  });
});
