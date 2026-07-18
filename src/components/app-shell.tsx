"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  FileText,
  Home,
  Package,
  Settings,
  Users,
} from "lucide-react";
import { useI18n } from "@/features/i18n/language-context";
import type { Dict } from "@/lib/i18n/dictionaries";
import { cn } from "@/lib/utils";

const NAV_ITEMS: Array<{
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

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { t } = useI18n();

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-surface">
      <main className="flex-1 pb-24">{children}</main>
      <nav className="fixed bottom-0 left-1/2 z-40 w-full max-w-md -translate-x-1/2 border-t border-border bg-card pb-[env(safe-area-inset-bottom)]">
        <div className="flex">
          {NAV_ITEMS.map((item) => {
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
                {String(t[item.labelKey])}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
