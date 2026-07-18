import * as React from "react";
import { cn } from "@/lib/utils";

/* OREN · Radio — natif stylé, point corail. */
export interface RadioProps
  extends Omit<React.ComponentProps<"input">, "type"> {
  label?: React.ReactNode;
}

const Radio = React.forwardRef<HTMLInputElement, RadioProps>(
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
            type="radio"
            className={cn(
              "peer size-5 shrink-0 appearance-none rounded-full border border-input bg-card transition-colors checked:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50",
              className,
            )}
            {...props}
          />
          <span className="pointer-events-none absolute left-1/2 top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent opacity-0 peer-checked:opacity-100" />
        </span>
        {label}
      </label>
    );
  },
);
Radio.displayName = "Radio";

export { Radio };
