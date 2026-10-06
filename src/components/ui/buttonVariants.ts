import { cva, type VariantProps } from "class-variance-authority";

// DESIGN_SYSTEM §8 button specs. Sizes: md 40px, sm 36px, lg 44px ("+ Add task").
export const buttonVariants = cva(
  [
    "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md font-semibold text-body",
    "transition-[background-color,color,transform] duration-(--dur-fast) ease-(--ease-out)",
    "active:scale-[0.97] motion-reduce:active:scale-100",
    "disabled:pointer-events-none disabled:opacity-50",
    "[&_svg]:size-4 [&_svg]:shrink-0",
  ],
  {
    variants: {
      variant: {
        primary: "bg-accent text-on-accent hover:bg-accent-hover",
        secondary: "border border-border bg-surface-2 text-text hover:bg-surface-3",
        ghost: "bg-transparent text-text hover:bg-surface-3",
        destructive: "bg-danger text-on-danger hover:opacity-90",
      },
      size: {
        sm: "h-9 px-3",
        md: "h-10 px-4",
        lg: "h-11 px-5",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export type ButtonVariantProps = VariantProps<typeof buttonVariants>;
