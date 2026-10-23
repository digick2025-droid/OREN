"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { renderDocumentHtml, type PdfCompany, type PdfDocumentData } from "@/services/pdf";
import { useI18n } from "@/features/i18n/language-context";

/** Largeur de rendu A4 (≈ 210 mm à 96 dpi), comme generate.ts. */
const A4_WIDTH_PX = 794;
const A4_HEIGHT_PX = 1123;

/** Devis fictif : montre catégories, remise, acompte et description. */
const SAMPLE_DOC: PdfDocumentData = {
  type: "devis",
  number: "DEV-2026-0042",
  title: "Rénovation salle de bain",
  description:
    "Dépose de l'ancien carrelage, reprise de la plomberie et pose de faïence murale.\n2e étage, quartier Bonapriso.",
  issueDate: "2026-10-23",
  clientName: "M. Jean Kouassi",
  clientPhone: "+237 690 00 00 00",
  lines: [
    { name: "Carreaux faïence 30×60", unit: "m²", category: "article", quantity: 12, unitPrice: 9500, lineTotal: 114000 },
    { name: "Mortier colle", unit: "sac", category: "article", quantity: 6, unitPrice: 6500, lineTotal: 39000 },
    { name: "Main d'œuvre pose", unit: "forfait", category: "main_oeuvre", quantity: 1, unitPrice: 85000, lineTotal: 85000 },
    { name: "Livraison matériel", unit: "forfait", category: "transport", quantity: 1, unitPrice: 10000, lineTotal: 10000 },
  ],
  subtotal: 248000,
  discount: 8000,
  vatRate: 0,
  vatAmount: 0,
  total: 240000,
  advanceAmount: 0,
  note: "",
  conditions: "Acompte de 50 % à la commande, solde à la fin des travaux.",
};

/**
 * Miniature A4 du document tel qu'il sortira, avec les réglages en cours
 * d'édition (couleur, modèle, logo, services…), mise à jour en direct.
 */
export function DocumentPreview({ company }: { company: PdfCompany }) {
  const { lang } = useI18n();
  const boxRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.4);

  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const update = () => setScale(box.clientWidth / A4_WIDTH_PX);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(box);
    return () => observer.disconnect();
  }, []);

  const html = useMemo(
    () => renderDocumentHtml(SAMPLE_DOC, company, lang),
    [company, lang],
  );

  return (
    <div
      ref={boxRef}
      className="relative w-full overflow-hidden rounded-xl border border-border bg-white shadow-sm"
      style={{ height: A4_HEIGHT_PX * scale }}
    >
      <iframe
        title="Aperçu du document"
        aria-hidden="true"
        tabIndex={-1}
        srcDoc={html}
        className="pointer-events-none absolute left-0 top-0 origin-top-left border-0"
        style={{
          width: A4_WIDTH_PX,
          height: A4_HEIGHT_PX,
          transform: `scale(${scale})`,
        }}
      />
    </div>
  );
}
