"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * OREN · Error boundary de segment.
 * Capture les erreurs de rendu dans l'arbre applicatif et propose de réessayer.
 * Rendue dans le layout racine : hérite du thème (clair/sombre) et des tokens.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[oren] boundary:", error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center bg-surface px-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-error-surface text-error">
        <AlertTriangle size={28} />
      </div>

      <p className="mt-6 text-[13px] font-bold uppercase tracking-[0.18em] text-accent">
        Oups
      </p>
      <h1 className="mt-2 text-[24px] font-extrabold text-navy">
        Une erreur est survenue
      </h1>
      <p className="mt-2 max-w-xs text-[14px] text-muted-foreground">
        Quelque chose s&apos;est mal passé. Vous pouvez réessayer ou revenir à
        l&apos;accueil.
      </p>

      {error.digest && (
        <p className="mt-3 font-mono text-[11px] text-muted-foreground/60">
          Réf. {error.digest}
        </p>
      )}

      <div className="mt-8 flex w-full max-w-xs flex-col gap-2.5">
        <Button variant="primary" onClick={() => reset()}>
          <RotateCw size={18} /> Réessayer
        </Button>
        <Button asChild variant="outline">
          <Link href="/accueil">Retour à l&apos;accueil</Link>
        </Button>
      </div>
    </div>
  );
}
