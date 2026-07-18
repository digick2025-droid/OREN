import * as React from "react";
import { cn } from "@/lib/utils";

/* =============================================================
   OREN — Logo
   Le "O" corail (anneau + lignes de vitesse) exprime la rapidité.
   Rendu 100% SVG → net à toutes les tailles, adaptable au thème.
   ============================================================= */

type LogoTone = "brand" | "navy" | "white" | "mono";

const TONES: Record<LogoTone, { mark: string; word: string }> = {
  // mark = couleur de l'anneau ; word = couleur du texte "OREN"
  brand: { mark: "hsl(var(--accent))", word: "hsl(var(--primary))" },
  navy: { mark: "hsl(var(--primary))", word: "hsl(var(--primary))" },
  white: { mark: "#FFFFFF", word: "#FFFFFF" },
  mono: { mark: "currentColor", word: "currentColor" },
};

/** Symbole seul — le "O" de vitesse : anneau ouvert à gauche + 2 lignes de vitesse. */
export function LogoMark({
  tone = "brand",
  className,
  ...props
}: { tone?: LogoTone } & React.SVGProps<SVGSVGElement>) {
  const c = TONES[tone];
  return (
    <svg
      viewBox="0 0 124 104"
      fill="none"
      role="img"
      aria-label="OREN"
      className={cn("h-8 w-8", className)}
      {...props}
    >
      <g
        stroke={c.mark}
        strokeWidth="14"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* Anneau ouvert (fente à gauche, ~9h) */}
        <path d="M34 36.6 A41 41 0 1 1 34.5 68.7" fill="none" />
        {/* Lignes de vitesse */}
        <line x1="14" y1="44" x2="56" y2="44" />
        <line x1="8" y1="60" x2="50" y2="60" />
      </g>
    </svg>
  );
}

/** Logo complet — symbole + mot-symbole OREN. */
export function Logo({
  tone = "brand",
  className,
  markClassName,
  wordClassName,
}: {
  tone?: LogoTone;
  className?: string;
  markClassName?: string;
  wordClassName?: string;
}) {
  const c = TONES[tone];
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark tone={tone} className={cn("h-8 w-8", markClassName)} />
      <span
        className={cn(
          "font-sans text-2xl font-bold leading-none tracking-tight",
          wordClassName,
        )}
        style={{ color: c.word }}
      >
        OREN
      </span>
    </span>
  );
}
