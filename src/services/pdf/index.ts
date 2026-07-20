/**
 * Moteur PDF — point d'entrée.
 * Rendu HTML A4 + impression/téléchargement via la boîte de dialogue
 * d'impression du navigateur (MVP). D'autres modèles s'ajoutent dans
 * le registre sans toucher au reste de l'application.
 */

import type { Company, DocumentItem, DocumentRow } from "@/types/database";
import { PDF_STRINGS } from "./strings";
import { classicTemplate } from "./templates/classic";
import type {
  PdfCompany,
  PdfDocumentData,
  PdfLang,
  PdfTemplate,
  PdfTemplateId,
} from "./types";

const TEMPLATES: Record<PdfTemplateId, PdfTemplate> = {
  classic: classicTemplate,
};

export function renderDocumentHtml(
  doc: PdfDocumentData,
  company: PdfCompany,
  lang: PdfLang = "fr",
  templateId: PdfTemplateId = "classic",
): string {
  return TEMPLATES[templateId].render(doc, company, PDF_STRINGS[lang]);
}

/** Adapte les lignes Supabase vers les données du moteur PDF. */
export function toPdfData(
  doc: DocumentRow,
  items: DocumentItem[],
): PdfDocumentData {
  return {
    type: doc.type,
    number: doc.number,
    title: doc.title,
    issueDate: doc.issue_date,
    clientName: doc.client_name,
    clientPhone: doc.client_phone,
    lines: items.map((item) => ({
      name: item.name,
      unit: item.unit,
      quantity: item.quantity,
      unitPrice: item.unit_price,
      lineTotal: item.line_total,
    })),
    subtotal: doc.subtotal,
    discount: doc.discount,
    vatRate: doc.vat_enabled ? doc.vat_rate : 0,
    vatAmount: doc.vat_amount,
    total: doc.total,
    advanceAmount: doc.advance_amount,
    note: doc.note,
    conditions: doc.conditions,
  };
}

export function toPdfCompany(
  company: Company,
  options?: { premiumBranding?: boolean },
): PdfCompany {
  return {
    name: company.name,
    ownerName: company.owner_name ?? "",
    slogan: company.slogan ?? "",
    phone: company.phone ?? "",
    whatsapp: company.whatsapp ?? "",
    address: company.address ?? "",
    email: company.email ?? "",
    logoUrl: company.logo_url ?? "",
    color: company.color,
    rccm: company.rccm ?? "",
    nif: company.nif ?? "",
    taxRegime: company.tax_regime,
    premiumBranding: options?.premiumBranding ?? false,
  };
}

/** Terminal tactile : l'impression d'iframe y est peu fiable. */
function isMobileBrowser(): boolean {
  if (typeof navigator !== "undefined" && navigator.userAgent) {
    if (/Android|iPhone|iPad|iPod|Mobile|Opera Mini|IEMobile/i.test(navigator.userAgent)) {
      return true;
    }
  }
  if (typeof window !== "undefined" && typeof window.matchMedia === "function") {
    return window.matchMedia("(pointer: coarse)").matches;
  }
  return false;
}

/**
 * Petit script injecté dans l'onglet ouvert pour déclencher tout seul la
 * boîte d'impression du navigateur (« Enregistrer en PDF »). Sans lui, sur
 * mobile l'utilisateur voit juste la page et ne sait pas comment la
 * télécharger — cause du « aucun bouton pour télécharger ».
 */
const AUTO_PRINT_SNIPPET =
  "<script>window.addEventListener('load',function(){setTimeout(function(){try{window.focus();window.print();}catch(e){}},400);});</" +
  "script>";

/**
 * Ouvre le document A4 autonome dans un nouvel onglet via un blob URL.
 * - `autoPrint` (téléchargement) : déclenche immédiatement « Imprimer →
 *   Enregistrer en PDF » du navigateur.
 * - sans `autoPrint` (aperçu) : ouvre simplement la page pour consultation.
 * Renvoie false si la fenêtre est bloquée (pop-up bloqueur).
 */
function openDocumentTab(html: string, autoPrint = false): boolean {
  try {
    const payload = autoPrint
      ? html.includes("</body>")
        ? html.replace("</body>", `${AUTO_PRINT_SNIPPET}</body>`)
        : html + AUTO_PRINT_SNIPPET
      : html;
    const blob = new Blob([payload], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const win = window.open(url, "_blank");
    if (!win) {
      URL.revokeObjectURL(url);
      return false;
    }
    // Libère l'objet une fois l'onglet chargé.
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
    return true;
  } catch {
    return false;
  }
}

/**
 * Ouvre le document en simple consultation (aperçu), sans forcer
 * l'impression. Renvoie false si la fenêtre est bloquée.
 */
export function previewDocument(html: string): boolean {
  return openDocumentTab(html, false);
}

/**
 * Imprime / télécharge le document A4 (« Imprimer → PDF »).
 *
 * - Desktop : iframe cachée + print(), avec repli sur l'ouverture d'un
 *   onglet si l'impression échoue.
 * - Mobile : ouverture directe dans un onglet (l'impression d'iframe
 *   cachée y est bloquée ou ignorée).
 *
 * Renvoie false uniquement si aucune sortie n'a pu s'ouvrir (pop-up
 * bloqué) : l'appelant affiche alors l'invite adéquate.
 */
export function printDocument(html: string): boolean {
  if (isMobileBrowser()) {
    return openDocumentTab(html, true);
  }

  try {
    const iframe = document.createElement("iframe");
    iframe.setAttribute("aria-hidden", "true");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    iframe.srcdoc = html;
    iframe.onload = () => {
      // Laisse le temps aux styles de se charger avant l'impression
      setTimeout(() => {
        try {
          const win = iframe.contentWindow;
          if (!win) throw new Error("iframe sans contentWindow");
          win.focus();
          win.print();
        } catch {
          // Repli : ouvre le document dans un onglet (avec impression auto)
          openDocumentTab(html, true);
        }
        // Nettoyage une fois la boîte de dialogue refermée
        setTimeout(() => iframe.remove(), 60_000);
      }, 300);
    };
    document.body.appendChild(iframe);
    return true;
  } catch {
    return openDocumentTab(html, true);
  }
}

export {
  DOCUMENTS_BUCKET,
  uploadSharedDocument,
  type ShareDocumentInput,
} from "./share";

export {
  downloadPdf,
  htmlToPdfBlob,
  sharePdf,
  type ShareResult,
  type SharePdfOptions,
} from "./generate";

export type {
  PdfCompany,
  PdfDocumentData,
  PdfLang,
  PdfTemplateId,
} from "./types";
