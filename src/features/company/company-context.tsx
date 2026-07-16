"use client";

import { createContext, useContext } from "react";
import type { Company } from "@/types/database";

const CompanyContext = createContext<Company | null>(null);

export function CompanyProvider({
  company,
  children,
}: {
  company: Company;
  children: React.ReactNode;
}) {
  return (
    <CompanyContext.Provider value={company}>
      {children}
    </CompanyContext.Provider>
  );
}

export function useCompany(): Company {
  const company = useContext(CompanyContext);
  if (!company) {
    throw new Error("useCompany doit être utilisé sous CompanyProvider");
  }
  return company;
}
