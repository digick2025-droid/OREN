"use client";

import { createContext, useContext } from "react";
import type { Company, CompanyRole } from "@/types/database";
import { useRolePreview } from "@/features/company/role-preview";

interface CompanyContextValue {
  company: Company;
  /** Rôle de l'utilisateur courant dans cette entreprise (null si inconnu). */
  role: CompanyRole | null;
}

const CompanyContext = createContext<CompanyContextValue | null>(null);

export function CompanyProvider({
  company,
  role = null,
  children,
}: {
  company: Company;
  role?: CompanyRole | null;
  children: React.ReactNode;
}) {
  return (
    <CompanyContext.Provider value={{ company, role }}>
      {children}
    </CompanyContext.Provider>
  );
}

export function useCompany(): Company {
  const ctx = useContext(CompanyContext);
  if (!ctx) {
    throw new Error("useCompany doit être utilisé sous CompanyProvider");
  }
  return ctx.company;
}

/**
 * Variante tolérante : renvoie null hors de CompanyProvider.
 * Nécessaire pour les composants partagés avec /bienvenue (création),
 * rendus avant que l'entreprise n'existe — ex. CompanyForm.
 */
export function useCompanyOrNull(): Company | null {
  return useContext(CompanyContext)?.company ?? null;
}

/**
 * Rôle de l'utilisateur courant dans l'entreprise active (null hors contexte,
 * ou si l'appartenance n'a pas été résolue). Sert à griser les actions côté UI
 * — la vérité reste côté RLS/RPC (0037/0038).
 */
export function useCurrentRole(): CompanyRole | null {
  const real = useContext(CompanyContext)?.role ?? null;
  // Prévisualisation admin : simule l'interface d'un autre rôle (ne touche
  // pas les données). null = rôle réel.
  const preview = useRolePreview();
  return preview ?? real;
}
