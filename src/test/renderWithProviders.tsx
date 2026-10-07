import type { ReactElement } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { createMemoryHistory, RouterProvider } from "@tanstack/react-router";
import { render } from "@testing-library/react";
import { createQueryClient } from "@/app/queryClient";
import { createAppRouter } from "@/app/router";
import { Toaster } from "@/components/ui/Toaster";
import { TooltipProvider } from "@/components/ui/Tooltip";

/** Renders UI with the same providers as the app (fresh query cache per test). */
export function renderWithProviders(ui: ReactElement) {
  const queryClient = createQueryClient();
  return {
    queryClient,
    ...render(
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          {ui}
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>,
    ),
  };
}

/** Renders the whole app shell at `path` with an in-memory router. */
export function renderApp(path = "/") {
  const router = createAppRouter(createMemoryHistory({ initialEntries: [path] }));
  return { router, ...renderWithProviders(<RouterProvider router={router} />) };
}
