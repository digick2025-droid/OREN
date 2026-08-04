"use client";

import { useState } from "react";
import { Bell, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/features/i18n/language-context";
import { activerPush } from "@/lib/push";

/**
 * Proposition d'activer les rappels, affichée juste après l'envoi d'un
 * document.
 *
 * C'est une carte de l'application, pas la fenêtre du navigateur : seul un
 * « Activer » déclenche la vraie demande de permission. Un « Plus tard » ne
 * consomme rien et laisse la porte ouverte, là où un refus opposé au
 * navigateur serait définitif.
 *
 * Le moment est choisi : l'utilisateur vient d'envoyer le document dont la
 * relance parlera. Demandée à l'ouverture de l'application, la permission se
 * fait refuser d'un réflexe — et ces comptes sont perdus pour toujours.
 */
export function PushInvite({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { t, lang } = useI18n();
  const [enCours, setEnCours] = useState(false);

  if (!open) return null;

  const accepter = async () => {
    setEnCours(true);
    try {
      const resultat = await activerPush(lang);
      if (resultat === "actif") toast.success(t.push_on);
      else if (resultat === "refuse") toast.error(t.push_blocked);
      else toast.error(t.push_failed);
    } finally {
      setEnCours(false);
      onClose();
    }
  };

  return (
    <div
      role="dialog"
      aria-label={t.push_invite_title}
      className="fixed bottom-20 left-1/2 z-50 w-[calc(100%-24px)] max-w-md -translate-x-1/2 rounded-2xl border border-border bg-card p-4 shadow-[0_8px_30px_rgba(19,31,53,0.18)]"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-muted text-navy">
          <Bell size={20} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[14.5px] font-bold text-navy">
            {t.push_invite_title}
          </div>
          <p className="mt-0.5 text-[12.5px] leading-snug text-muted-foreground">
            {t.push_invite_sub}
          </p>
        </div>
        <button
          type="button"
          aria-label={t.push_invite_later}
          onClick={onClose}
          className="shrink-0 rounded-lg p-1 text-muted-foreground/70 hover:bg-muted"
        >
          <X size={17} />
        </button>
      </div>
      <div className="mt-3 flex gap-2">
        <Button
          size="sm"
          className="flex-1"
          disabled={enCours}
          onClick={() => void accepter()}
        >
          <Bell size={15} /> {t.push_invite_yes}
        </Button>
        <Button size="sm" variant="ghost" disabled={enCours} onClick={onClose}>
          {t.push_invite_later}
        </Button>
      </div>
    </div>
  );
}
