"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { useI18n } from "@/features/i18n/language-context";
import {
  activerPush,
  desactiverPush,
  lirePushStatus,
  type PushStatus,
} from "@/lib/push";

/**
 * Interrupteur des relances push, dans les Réglages.
 *
 * La permission n'est demandée qu'ici, sur un geste explicite : demandée au
 * chargement, elle se fait refuser d'un réflexe, et ce refus est définitif —
 * l'application n'a aucun moyen de reposer la question.
 */
export function PushToggle() {
  const { t, lang } = useI18n();
  const [statut, setStatut] = useState<PushStatus | null>(null);
  const [enCours, setEnCours] = useState(false);

  useEffect(() => {
    void lirePushStatus().then(setStatut);
  }, []);

  // Navigateur sans push (ou iPhone dont la PWA n'est pas installée) : mieux
  // vaut ne rien montrer qu'un interrupteur qui ne pourra jamais s'allumer.
  if (statut === null || statut === "indisponible") return null;

  const basculer = async (actif: boolean) => {
    setEnCours(true);
    try {
      if (actif) {
        const resultat = await activerPush(lang);
        setStatut(resultat);
        if (resultat === "actif") toast.success(t.push_on);
        else if (resultat === "refuse") toast.error(t.push_blocked);
        else toast.error(t.push_failed);
      } else {
        await desactiverPush();
        setStatut("inactif");
        toast.success(t.push_off);
      }
    } finally {
      setEnCours(false);
    }
  };

  return (
    <div className="flex items-center gap-3">
      {statut === "refuse" ? (
        <span className="text-[12px] text-muted-foreground">
          {t.push_blocked_short}
        </span>
      ) : (
        <Switch
          checked={statut === "actif"}
          disabled={enCours}
          onCheckedChange={(actif) => void basculer(actif)}
          aria-label={t.push_title}
        />
      )}
    </div>
  );
}
