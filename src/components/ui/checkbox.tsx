import * as React from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

/* OREN · Checkbox — natif stylé, coche corail. */
export interface CheckboxProps
  extends Omit<React.ComponentProps<"input">, "type"> {
  label?: React.ReactNode;
}

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, label, id, ...props }, ref) => {
    const autoId = React.useId();
    const inputId = id ?? autoId;
    return (
      <label
        htmlFor={inputId}
        className="inline-flex cursor-pointer select-none items-center gap-2.5 text-[15px] text-foreground"
      >
        <span className="relative inline-flex">
          <input
            ref={ref}
            id={inputId}
            type="checkbox"
            className={cn(
              "peer size-5 shrink-0 appearance-none rounded-[6px] border border-input bg-card transition-colors checked:border-accent checked:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50",
              className,
            )}
            {...props}
          />
          <Check
            aria-hidden
            strokeWidth={3}
            className="pointer-events-none absolute left-1/2 top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 text-white opacity-0 peer-checked:opacity-100"
          />
        </span>
        {label}
      </label>
    );
  },
);
Checkbox.displayName = "Checkbox";

export { Checkbox };
