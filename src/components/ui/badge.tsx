import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/* OREN · Badge / Statut — pilule teintée, texte lisible (AA). */
const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold leading-none",
  {
    variants: {
      variant: {
        neutral: "bg-muted text-muted-foreground",
        success: "bg-success-surface text-success-foreground",
        warning: "bg-warning-surface text-warning-foreground",
        error: "bg-error-surface text-error-foreground",
        info: "bg-info-surface text-info-foreground",
        accent: "bg-accent/12 text-accent",
      },
    },
    defaultVariants: { variant: "neutral" },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  /** Override manuel (rétro-compat) — prioritaire sur `variant`. */
  bg?: string;
  color?: string;
}

function Badge({ className, variant, bg, color, style, ...props }: BadgeProps) {
  // Si bg/color fournis, on ignore les classes de variante (mode legacy).
  const useOverride = bg != null || color != null;
  return (
    <span
      className={cn(
        useOverride
          ? "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold leading-none"
          : badgeVariants({ variant }),
        className,
      )}
      style={useOverride ? { backgroundColor: bg, color, ...style } : style}
      {...props}
    />
  );
}

export { Badge, badgeVariants };
