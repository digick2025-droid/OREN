"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/* =============================================================
   OREN · ScrollReveal — apparition douce à l'entrée dans le viewport.

   Le contenu est rendu VISIBLE par défaut (SSR, sans JS, et pour tout
   ce qui est déjà à l'écran au chargement) : on ne masque un bloc que
   s'il est réellement plus bas dans la page. Aucun contenu ne peut donc
   rester invisible si l'observer ne se déclenche jamais.
   ============================================================= */

/** Fraction du viewport en dessous de laquelle un bloc est « hors écran ». */
const OFFSCREEN_RATIO = 0.9;

export function ScrollReveal({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [hidden, setHidden] = React.useState(false);

  React.useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    // Déjà visible au chargement : pas d'animation, pas de clignotement.
    if (el.getBoundingClientRect().top < window.innerHeight * OFFSCREEN_RATIO) {
      return;
    }

    setHidden(true);
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setHidden(false);
          observer.disconnect();
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      data-hidden={hidden || undefined}
      className={cn(
        "transition-[opacity,transform] duration-500 ease-out data-[hidden]:translate-y-3.5 data-[hidden]:opacity-0 motion-reduce:transition-none",
        className,
      )}
    >
      {children}
    </div>
  );
}
