"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/admin", label: "Vue d'ensemble" },
  { href: "/admin/utilisateurs", label: "Utilisateurs" },
  { href: "/admin/abonnements", label: "Abonnements" },
  { href: "/admin/promos", label: "Codes promo" },
  { href: "/admin/offres", label: "Offres" },
  { href: "/admin/paiements", label: "Paiements" },
];

export function AdminNav() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  const signOut = async () => {
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  };

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-card">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3">
          <Logo className="hidden sm:inline-flex" markClassName="h-7 w-7" wordClassName="text-lg" />
          <span className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
            Admin
          </span>
        </div>
        <button
          type="button"
          onClick={() => void signOut()}
          className="flex items-center gap-1.5 text-[13px] font-semibold text-muted-foreground transition-colors hover:text-foreground"
        >
          <LogOut size={16} /> Déconnexion
        </button>
      </div>
      <nav className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 pb-2 sm:px-6">
        {NAV_ITEMS.map((item) => {
          const active =
            item.href === "/admin"
              ? pathname === "/admin"
              : pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "whitespace-nowrap rounded-field px-3.5 py-2 text-[13.5px] font-semibold transition-colors",
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted",
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
