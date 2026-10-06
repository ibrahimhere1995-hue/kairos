import {
  Activity,
  Briefcase,
  CircleCheck,
  CircleDot,
  CircleMinus,
  Clock,
  GraduationCap,
  Heart,
  House,
  RotateCcw,
  type LucideIcon,
} from "lucide-react";

/** CSS custom properties shown as plain swatches, grouped as in DESIGN_SYSTEM §3. */
export const SWATCH_GROUPS: { titleKey: string; tokens: string[] }[] = [
  {
    titleKey: "styleguide.brand",
    tokens: [
      "--brand-midnight",
      "--brand-gold",
      "--brand-gold-soft",
      "--brand-gold-deep",
      "--brand-ivory",
    ],
  },
  {
    titleKey: "styleguide.surfaces",
    tokens: [
      "--bg",
      "--surface",
      "--surface-2",
      "--surface-3",
      "--border",
      "--border-strong",
      "--text",
      "--text-muted",
      "--text-subtle",
    ],
  },
  {
    titleKey: "styleguide.feedback",
    tokens: [
      "--accent",
      "--accent-hover",
      "--accent-text",
      "--focus-ring",
      "--success",
      "--warning",
      "--danger",
      "--info",
    ],
  },
];

/** Status always pairs colour with an icon and a label (DESIGN_SYSTEM §2 rule 9, §3.4). */
export const STATUS_SAMPLES: { token: string; icon: LucideIcon; labelKey: string }[] = [
  { token: "--status-now", icon: CircleDot, labelKey: "status.now" },
  { token: "--status-upcoming", icon: Clock, labelKey: "status.upcoming" },
  { token: "--status-slipped", icon: RotateCcw, labelKey: "status.slipped" },
  { token: "--status-done", icon: CircleCheck, labelKey: "status.done" },
  { token: "--status-skipped", icon: CircleMinus, labelKey: "status.skipped" },
];

export const AREA_SAMPLES: { token: string; icon: LucideIcon; labelKey: string }[] = [
  { token: "--area-work", icon: Briefcase, labelKey: "areas.work" },
  { token: "--area-home", icon: House, labelKey: "areas.home" },
  { token: "--area-personal", icon: Heart, labelKey: "areas.personal" },
  { token: "--area-learning", icon: GraduationCap, labelKey: "areas.learning" },
  { token: "--area-health", icon: Activity, labelKey: "areas.health" },
];

/** Type roles from DESIGN_SYSTEM §4; class strings are complete so Tailwind can see them. */
export const TYPE_SAMPLES: { role: string; className: string }[] = [
  { role: "display", className: "font-display text-display" },
  { role: "h1", className: "font-display text-h1" },
  { role: "h2", className: "text-h2" },
  { role: "h3", className: "text-h3" },
  { role: "body", className: "text-body" },
  { role: "small", className: "text-small" },
  { role: "caption", className: "text-caption uppercase" },
];
