"use client";

import { useEffect } from "react";
import { trackOnce, type FunnelEvent } from "@/lib/analytics";

/** Enregistre une vue de page depuis un composant serveur. */
export function TrackView({ event }: { event: FunnelEvent }) {
  useEffect(() => {
    trackOnce(event);
  }, [event]);
  return null;
}
