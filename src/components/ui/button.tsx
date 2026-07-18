import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/* OREN · Button — 48px, radius 14, micro-scale au clic, focus corail subtil. */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-field text-sm font-semibold transition-[color,background-color,transform,box-shadow] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 active:scale-[.985] [&_svg]:size-[18px] [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        // CTA principal OREN — corail
        primary: "bg-accent text-accent-foreground hover:bg-accent/90 shadow-xs",
        accent: "bg-accent text-accent-foreground hover:bg-accent/90 shadow-xs",
        // Solide navy
        default: "bg-primary text-primary-foreground hover:bg-primary/90 shadow-xs",
        // Secondaire — fond clair, contour discret
        outline: "border border-border bg-card text-foreground hover:bg-muted",
        secondary: "border border-border bg-card text-foreground hover:bg-muted",
        // Ghost — texte seul
        ghost: "text-foreground hover:bg-muted",
        // Danger
        destructive: "bg-error text-white hover:bg-error/90 shadow-xs",
        danger: "bg-error/10 text-error hover:bg-error/15",
        whatsapp: "bg-whatsapp text-white hover:bg-whatsapp/90 shadow-xs",
      },
      size: {
        default: "h-12 px-5", // 48px
        sm: "h-9 rounded-md px-3.5 text-[13px]",
        lg: "h-[52px] px-6 text-base",
        icon: "h-11 w-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
