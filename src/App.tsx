import { ThemeProvider } from "@/app/theme/ThemeProvider";
import { Styleguide } from "@/features/dev/Styleguide";

// Temporary: the styleguide shows in dev builds until routing arrives in P1-T03.
export default function App() {
  return (
    <ThemeProvider>
      {import.meta.env.DEV ? <Styleguide /> : <main className="min-h-screen" />}
    </ThemeProvider>
  );
}
