"use client";

import { Card } from "@/components/ui/card";
import { useI18n } from "@/features/i18n/language-context";
import { METIERS, type Metier } from "@/lib/catalog-templates";
import { metierLabel } from "@/lib/i18n/labels";

/**
 * Sélecteur de métier, un seul tap, toujours skippable.
 *
 * Affiché au premier élément d'un document — jamais à l'inscription — pour
 * supprimer la « page blanche » sans ajouter de friction à la création de
 * compte. Le composant ne décide de rien : l'appelant fournit `onSelect` et
 * `onSkip` (voir document-builder pour les comptes, express-form pour l'anonyme).
 *
 * `variant` change uniquement le sous-titre : « catalog » quand la sélection
 * pré-remplit réellement le catalogue, « suggest » quand elle ne sert qu'à
 * proposer des suggestions de saisie.
 */
export function MetierPicker({
  variant,
  pending = false,
  onSelect,
  onSkip,
}: {
  variant: "catalog" | "suggest";
  pending?: boolean;
  onSelect: (metier: Metier) => void;
  onSkip: () => void;
}) {
  const { t } = useI18n();

  return (
    <Card className="mt-2 p-4">
      <div className="text-[14.5px] font-extrabold text-navy">
        {t.metier_title}
      </div>
      <p className="mt-1 text-[12.5px] text-muted-foreground">
        {variant === "catalog" ? t.metier_sub_catalog : t.metier_sub_suggest}
      </p>

      <div className="mt-3 grid grid-cols-2 gap-2">
        {METIERS.map((metier) => (
          <button
            key={metier}
            type="button"
            disabled={pending}
            onClick={() => onSelect(metier)}
            className="rounded-xl border-[1.5px] border-border bg-card px-3 py-2.5 text-[13px] font-semibold text-navy transition-colors hover:border-navy disabled:opacity-50"
          >
            {metierLabel(t, metier)}
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={onSkip}
        className="mt-3 w-full text-center text-[12.5px] font-semibold text-muted-foreground underline"
      >
        {t.metier_skip}
      </button>
    </Card>
  );
}
