"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

export function ScreenHeader({
  title,
  backHref,
  onBack,
  action,
}: {
  title: string;
  backHref?: string;
  onBack?: () => void;
  action?: React.ReactNode;
}) {
  const router = useRouter();

  return (
    <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-border bg-card/95 px-4 py-3.5 backdrop-blur">
      {(backHref !== undefined || onBack) && (
        <button
          type="button"
          aria-label="Retour"
          onClick={() => {
            if (onBack) return onBack();
            if (backHref) return router.push(backHref);
            router.back();
          }}
          className="-ml-1 rounded-xl p-1.5 text-navy hover:bg-muted"
        >
          <ArrowLeft size={22} />
        </button>
      )}
      <h1 className="flex-1 truncate text-[17px] font-bold text-navy">
        {title}
      </h1>
      {action}
    </header>
  );
}
