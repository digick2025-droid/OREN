"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Info, X } from "lucide-react";
import { useActiveAnnouncement } from "@/hooks/use-active-announcement";
import { cn } from "@/lib/utils";

const DISMISS_KEY = "oren_announcement_dismissed";

export function AnnouncementBanner() {
  const { data: announcement } = useActiveAnnouncement();
  const [dismissedId, setDismissedId] = useState<string | null>(null);

  useEffect(() => {
    setDismissedId(sessionStorage.getItem(DISMISS_KEY));
  }, []);

  if (!announcement || announcement.id === dismissedId) return null;

  const dismiss = () => {
    sessionStorage.setItem(DISMISS_KEY, announcement.id);
    setDismissedId(announcement.id);
  };

  const isWarning = announcement.level === "warning";

  return (
    <div
      className={cn(
        "flex items-start gap-2.5 px-4 py-3 text-[13px]",
        isWarning
          ? "bg-warning-surface text-warning-foreground"
          : "bg-info-surface text-info-foreground",
      )}
    >
      {isWarning ? (
        <AlertTriangle size={16} className="mt-0.5 shrink-0" />
      ) : (
        <Info size={16} className="mt-0.5 shrink-0" />
      )}
      <p className="flex-1 font-medium">{announcement.message}</p>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Fermer"
        className="shrink-0 opacity-70 hover:opacity-100"
      >
        <X size={16} />
      </button>
    </div>
  );
}
