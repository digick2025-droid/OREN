"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/features/i18n/language-context";

const DISMISS_KEY = "digick_pwa_dismissed";
/** Posé au premier document partagé : avant, la bannière n'a rien à vendre. */
const SHARED_KEY = "oren_first_share";
const SHARED_EVENT = "oren:document-shared";

/**
 * À appeler après un partage réussi. Mémorise l'étape et prévient la bannière
 * si elle est déjà montée (même session), sans dépendance entre composants.
 */
export function markDocumentShared(): void {
  try {
    localStorage.setItem(SHARED_KEY, "1");
  } catch {
    // Stockage indisponible : la bannière ne sera simplement pas proposée.
  }
  window.dispatchEvent(new Event(SHARED_EVENT));
}

function hasShared(): boolean {
  try {
    return localStorage.getItem(SHARED_KEY) === "1";
  } catch {
    return false;
  }
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function isIos(): boolean {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
}

function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in window.navigator &&
      (window.navigator as { standalone?: boolean }).standalone === true)
  );
}

/**
 * Bannière « Installer l'application » :
 * - Android / Chrome : invite d'installation native (beforeinstallprompt)
 * - iPhone : instructions Partager → Sur l'écran d'accueil
 * En attendant la disponibilité sur Play Store et App Store.
 *
 * N'apparaît qu'après le premier document partagé : affichée dès la landing
 * ou l'inscription, elle interrompait le visiteur avant qu'il ait vu la
 * moindre valeur — et se faisait fermer par réflexe, définitivement.
 */
export function InstallPrompt() {
  const { t } = useI18n();
  const [installEvent, setInstallEvent] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [showIosHint, setShowIosHint] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isStandalone() || localStorage.getItem(DISMISS_KEY)) return;

    let eligible = hasShared();
    let captured: BeforeInstallPromptEvent | null = null;
    const ios = isIos();

    const refresh = () => {
      if (!eligible) return;
      if (ios) {
        setShowIosHint(true);
        setVisible(true);
      } else if (captured) {
        setVisible(true);
      }
    };

    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      captured = event as BeforeInstallPromptEvent;
      setInstallEvent(captured);
      refresh();
    };
    const onShared = () => {
      eligible = true;
      refresh();
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener(SHARED_EVENT, onShared);
    refresh();

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener(SHARED_EVENT, onShared);
    };
  }, []);

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, "1");
    setVisible(false);
  };

  const install = async () => {
    if (!installEvent) return;
    await installEvent.prompt();
    const choice = await installEvent.userChoice;
    if (choice.outcome === "accepted") {
      setVisible(false);
    }
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-20 left-1/2 z-50 w-[calc(100%-24px)] max-w-md -translate-x-1/2 rounded-2xl border border-border bg-card p-4 shadow-[0_8px_30px_rgba(19,31,53,0.18)]">
      <div className="flex items-start gap-3">
        <Image
          src="/icons/icon-192.png"
          alt=""
          width={44}
          height={44}
          className="h-11 w-11 shrink-0 rounded-xl"
        />
        <div className="min-w-0 flex-1">
          <div className="text-[14.5px] font-bold text-navy">
            {t.pwa_title}
          </div>
          <p className="mt-0.5 text-[12.5px] leading-snug text-muted-foreground">
            {showIosHint && !installEvent ? t.pwa_ios_hint : t.pwa_sub}
          </p>
        </div>
        <button
          type="button"
          aria-label={t.pwa_later}
          onClick={dismiss}
          className="shrink-0 rounded-lg p-1 text-muted-foreground/70 hover:bg-muted"
        >
          <X size={17} />
        </button>
      </div>
      {installEvent && (
        <div className="mt-3 flex gap-2">
          <Button size="sm" className="flex-1" onClick={() => void install()}>
            <Download size={15} /> {t.pwa_install}
          </Button>
          <Button size="sm" variant="ghost" onClick={dismiss}>
            {t.pwa_later}
          </Button>
        </div>
      )}
    </div>
  );
}
