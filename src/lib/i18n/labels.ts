/** Libellés traduits des énumérations métier. */

import type {
  CatalogItemType,
  DocumentStatus,
  DocumentType,
  TaxRegime,
} from "@/types/database";
import type { Dict } from "./dictionaries";

export function statusLabel(t: Dict, status: DocumentStatus): string {
  const map: Record<DocumentStatus, string> = {
    brouillon: t.st_brouillon,
    envoye: t.st_envoye,
    accepte: t.st_accepte,
    refuse: t.st_refuse,
    paye: t.st_paye,
  };
  return map[status];
}

export function typeLabel(t: Dict, type: DocumentType): string {
  const map: Record<DocumentType, string> = {
    devis: t.type_devis,
    facture: t.type_facture,
    proforma: t.type_proforma,
  };
  return map[type];
}

export function itemTypeLabel(t: Dict, type: CatalogItemType): string {
  return type === "produit" ? t.type_produit : t.type_prestation;
}

export function regimeLabel(t: Dict, regime: TaxRegime): string {
  const map: Record<TaxRegime, string> = {
    reel: t.regime_reel,
    synthetique: t.regime_synthetique,
    franchise: t.regime_franchise,
  };
  return map[regime];
}
