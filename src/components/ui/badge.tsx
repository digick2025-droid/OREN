import * as React from "react";
import { cn } from "@/lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  bg?: string;
  color?: string;
}

function Badge({ className, bg, color, style, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold",
        className,
      )}
      style={{ backgroundColor: bg, color, ...style }}
      {...props}
    />
  );
}

export { Badge };
