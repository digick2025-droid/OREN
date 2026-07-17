import { cn } from "@/lib/utils";

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-2xl bg-[#E6E8EE]", className)}
      {...props}
    />
  );
}

/** Squelette d'une liste de cartes (documents, clients, articles…) */
function ListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, index) => (
        <Skeleton key={index} className="h-[76px] w-full" />
      ))}
    </div>
  );
}

export { Skeleton, ListSkeleton };
