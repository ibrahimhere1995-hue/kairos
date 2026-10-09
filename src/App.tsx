import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { MotionConfig } from "motion/react";
import { AppEventsListener } from "@/app/AppEventsListener";
import { AppearanceSync } from "@/app/AppearanceSync";
import { ItemsChangedListener } from "@/app/ItemsChangedListener";
import { createQueryClient } from "@/app/queryClient";
import { createAppRouter } from "@/app/router";
import { ThemeProvider } from "@/app/theme/ThemeProvider";
import { Toaster } from "@/components/ui/Toaster";
import { TooltipProvider } from "@/components/ui/Tooltip";

const router = createAppRouter();
const queryClient = createQueryClient();
const navigate = (path: string) => void router.navigate({ to: path });

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ItemsChangedListener />
      <AppEventsListener navigate={navigate} />
      <AppearanceSync />
      <ThemeProvider>
        {/* "user": Motion follows the OS reduce-motion setting (DESIGN_SYSTEM §6.3). */}
        <MotionConfig reducedMotion="user">
          <TooltipProvider delayDuration={400}>
            <RouterProvider router={router} />
            <Toaster />
          </TooltipProvider>
        </MotionConfig>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
