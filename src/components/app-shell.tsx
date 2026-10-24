"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  FileText,
  Home,
  Package,
  Settings,
  Users,
  Wrench,
} from "lucide-react";
import { AnnouncementBanner } from "@/components/announcement-banner";
import { useEnterpriseAccess } from "@/hooks/use-enterprise";
import { useI18n } from "@/features/i18n/language-context";
import type { Dict } from "@/lib/i18n/dictionaries";
import { cn } from "@/lib/utils";

type NavItem = { href: string; label: string; icon: typeof Home };

const BASE_ITEMS: Array<{
  href: string;
  labelKey: keyof Dict;
  icon: typeof Home;
}> = [
  { href: "/accueil", labelKey: "nav_home", icon: Home },
  { href: "/documents", labelKey: "nav_docs", icon: FileText },
  { href: "/clients", labelKey: "nav_clients", icon: Users },
  { href: "/catalogue", labelKey: "nav_catalog", icon: Package },
  { href: "/reglages", labelKey: "nav_settings", icon: Settings },
];

/**
 * Écrans de saisie d'un document : la barre de navigation disparaît pour
 * laisser la place au total et au bouton « Générer », collés en bas. Moins
 * de sorties possibles pendant les 2 minutes qui comptent.
 */
function isFocusRoute(pathname: string): boolean {
  return (
    pathname === "/nouveau" || /^\/documents\/[^/]+\/modifier$/.test(pathname)
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { t } = useI18n();
  const enterpriseAccess = useEnterpriseAccess();
  const focus = isFocusRoute(pathname);

  const items: NavItem[] = BASE_ITEMS.map((item) => ({
    href: item.href,
    label: String(t[item.labelKey]),
    icon: item.icon,
  }));
  // OREN ENTREPRISE : accès au module terrain (gaté offre/preview/admin).
  if (enterpriseAccess) {
    items.splice(1, 0, {
      href: "/terrain",
      label: "Terrain",
      icon: Wrench,
    });
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-surface">
      <AnnouncementBanner />
      <main className={cn("flex-1", focus ? "pb-0" : "pb-24")}>{children}</main>
      {focus ? null : (
        <nav className="fixed bottom-0 left-1/2 z-40 w-full max-w-md -translate-x-1/2 border-t border-border bg-card pb-[env(safe-area-inset-bottom)]">
          <div className="flex">
            {items.map((item) => {
              const active =
                pathname === item.href || pathname.startsWith(`${item.href}/`);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex flex-1 flex-col items-center gap-1 py-2.5 text-[10.5px] font-semibold transition-colors",
                    active ? "text-navy" : "text-muted-foreground/70",
                  )}
                >
                  <Icon size={21} strokeWidth={active ? 2.4 : 2} />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </nav>
      )}
    </div>
  );
}
