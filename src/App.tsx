import { RouterProvider } from "@tanstack/react-router";
import { createAppRouter } from "@/app/router";
import { ThemeProvider } from "@/app/theme/ThemeProvider";
import { TooltipProvider } from "@/components/ui/Tooltip";

const router = createAppRouter();

export default function App() {
  return (
    <ThemeProvider>
      <TooltipProvider delayDuration={400}>
        <RouterProvider router={router} />
      </TooltipProvider>
    </ThemeProvider>
  );
}
