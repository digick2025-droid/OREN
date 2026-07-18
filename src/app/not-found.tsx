import Link from "next/link";
import { Compass } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * OREN · Page 404 — introuvable.
 * Rendue dans le layout racine : hérite du thème (clair/sombre) et des tokens.
 */
export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center bg-surface px-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted text-navy">
        <Compass size={28} />
      </div>

      <p className="mt-6 text-[13px] font-bold uppercase tracking-[0.18em] text-accent">
        Erreur 404
      </p>
      <h1 className="mt-2 text-[24px] font-extrabold text-navy">
        Page introuvable
      </h1>
      <p className="mt-2 max-w-xs text-[14px] text-muted-foreground">
        La page que vous cherchez a été déplacée ou n&apos;existe pas.
      </p>

      <Button asChild variant="primary" className="mt-8 w-full max-w-xs">
        <Link href="/accueil">Retour à l&apos;accueil</Link>
      </Button>
    </div>
  );
}
