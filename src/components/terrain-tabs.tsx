"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Boxes,
  CalendarDays,
  LayoutDashboard,
  RefreshCw,
  Wallet,
  Wrench,
} from "lucide-react";
import { useCurrentRole } from "@/features/company/company-context";
import { RolePreviewBar } from "@/components/role-preview-bar";
import { canSeeTreasury } from "@/lib/roles";
import { cn } from "@/lib/utils";

type Tab = { href: string; label: string; icon: typeof Wrench; exact?: boolean };

const TABS: Tab[] = [
  { href: "/terrain", label: "Synthèse", icon: LayoutDashboard, exact: true },
  { href: "/interventions", label: "Interventions", icon: Wrench, exact: true },
  { href: "/interventions/planning", label: "Planning", icon: CalendarDays },
  { href: "/stock", label: "Stock", icon: Boxes },
  { href: "/contrats", label: "Contrats", icon: RefreshCw },
];

/** Sous-navigation du module Terrain, partagée par toutes ses pages. */
export function TerrainTabs() {
  const pathname = usePathname();
  const showTreasury = canSeeTreasury(useCurrentRole());

  const tabs: Tab[] = showTreasury
    ? [...TABS, { href: "/tresorerie", label: "Trésorerie", icon: Wallet }]
    : TABS;

  return (
    <>
      <div className="flex gap-2 overflow-x-auto px-4 pt-3">
        {tabs.map((t) => {
        const Icon = t.icon;
        const active = t.exact
          ? pathname === t.href
          : pathname === t.href || pathname.startsWith(`${t.href}/`);
        return (
          <Link
            key={t.href}
            href={t.href}
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-2 text-[12.5px] font-semibold transition-colors",
              active
                ? "border-navy bg-navy text-white"
                : "border-border bg-card text-navy hover:bg-muted",
            )}
          >
            <Icon size={15} /> {t.label}
          </Link>
        );
      })}
      </div>
      <RolePreviewBar />
    </>
  );
}
