import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-2xl text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-navy text-white hover:bg-navy/90 active:scale-[.99]",
        accent: "bg-coral text-white hover:bg-coral/90 active:scale-[.99]",
        outline:
          "border-[1.5px] border-[#E2E5EC] bg-white text-navy hover:bg-[#F6F7F9]",
        ghost: "text-navy hover:bg-[#EEF0F4]",
        destructive: "bg-danger/10 text-danger hover:bg-danger/15",
        whatsapp: "bg-whatsapp text-white hover:bg-whatsapp/90",
      },
      size: {
        default: "h-[52px] px-5",
        sm: "h-9 rounded-xl px-3 text-[13px]",
        lg: "h-14 px-6 text-base",
        icon: "h-10 w-10 rounded-xl",
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
