import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import {
  CheckCircle2,
  Info,
  AlertTriangle,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

/* OREN · Alert — fond teinté doux, icône Lucide fine, radius 14. */
const alertVariants = cva(
  "flex items-start gap-3 rounded-field p-4 text-sm",
  {
    variants: {
      variant: {
        success: "bg-success-surface text-success-foreground",
        info: "bg-info-surface text-info-foreground",
        warning: "bg-warning-surface text-warning-foreground",
        error: "bg-error-surface text-error-foreground",
      },
    },
    defaultVariants: { variant: "info" },
  },
);

const ICONS: Record<string, LucideIcon> = {
  success: CheckCircle2,
  info: Info,
  warning: AlertTriangle,
  error: XCircle,
};

export interface AlertProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "title">,
    VariantProps<typeof alertVariants> {
  title?: React.ReactNode;
}

function Alert({ className, variant = "info", title, children, ...props }: AlertProps) {
  const Icon = ICONS[variant ?? "info"] ?? Info;
  return (
    <div role="alert" className={cn(alertVariants({ variant }), className)} {...props}>
      <Icon aria-hidden className="mt-0.5 size-[18px] shrink-0" strokeWidth={2} />
      <div className="min-w-0 flex-1">
        {title ? <p className="font-semibold leading-snug">{title}</p> : null}
        {children ? (
          <div className={cn("leading-snug", title && "mt-0.5 opacity-90")}>
            {children}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export { Alert, alertVariants };
