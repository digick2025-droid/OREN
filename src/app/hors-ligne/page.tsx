import Link from "next/link";
import { cookies } from "next/headers";
import { WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LANG_COOKIE, parseLang } from "@/lib/i18n/config";
import { getDict } from "@/lib/i18n/dictionaries";

/**
 * OREN · Page de repli hors-ligne.
 *
 * Servie par le service worker quand une navigation échoue et qu'aucune version
 * en cache n'existe pour cette URL. Volontairement sans appel Supabase : elle
 * doit pouvoir être préchargée par un visiteur déconnecté, sinon le repli
 * n'existe pas au moment où l'on en a besoin.
 */
export default async function HorsLignePage() {
  const cookieStore = await cookies();
  const t = getDict(parseLang(cookieStore.get(LANG_COOKIE)?.value));

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center bg-surface px-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
        <WifiOff size={28} />
      </div>

      <p className="mt-6 text-[13px] font-bold uppercase tracking-[0.18em] text-accent">
        {t.offline_page_kicker}
      </p>
      <h1 className="mt-2 text-[24px] font-extrabold text-navy">
        {t.offline_page_title}
      </h1>
      <p className="mt-2 max-w-xs text-[14px] text-muted-foreground">
        {t.offline_page_body}
      </p>

      <div className="mt-8 w-full max-w-xs">
        <Button asChild variant="outline" className="w-full">
          <Link href="/accueil">{t.offline_page_retry}</Link>
        </Button>
      </div>
    </div>
  );
}
