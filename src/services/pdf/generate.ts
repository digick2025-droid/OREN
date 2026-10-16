/**
 * Génération d'un vrai fichier PDF côté navigateur + partage natif.
 *
 * Le moteur (index/templates) produit un HTML A4 autonome ; ici on le
 * rastérise (html2canvas) et on l'emballe en PDF A4 (jsPDF) pour obtenir
 * un fichier `.pdf` réel — téléchargeable ET partageable en pièce jointe
 * via le sélecteur de partage du téléphone (`navigator.share({files})`),
 * ce qu'un simple lien wa.me ne permet pas.
 *
 * Les deux librairies sont chargées en import dynamique : elles ne pèsent
 * sur le bundle que lorsque l'utilisateur télécharge ou partage réellement.
 */

// Dimensions A4 en millimètres.
const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;
// Largeur de rendu ≈ 210mm @96dpi, pour un rendu net et stable.
const RENDER_WIDTH_PX = 794;
// Facteur de rendu html2canvas (netteté ×2).
const CAPTURE_SCALE = 2;
// Marges des pages de suite (la 1re page porte déjà son padding HTML).
const CONTINUATION_TOP_MM = 12;
const BOTTOM_MARGIN_MM = 12;
// Marge basse minimale tolérée sur la dernière page avant d'en ajouter une.
const MIN_LAST_BOTTOM_MM = 5;

/** Bande verticale (px CSS, relative au haut de la page). */
interface Band {
  top: number;
  bottom: number;
}

interface Capture {
  canvas: HTMLCanvasElement;
  /** Largeur CSS de la page capturée, en px. */
  widthPx: number;
  /** Bas du dernier contenu réel (hors padding final), en px CSS. */
  contentBottom: number;
  /** Blocs insécables : lignes du tableau, totaux, signatures… */
  blocks: Band[];
  /** En-tête du tableau, répété en haut des pages de suite. */
  thead: Band | null;
  /** Zone des lignes du tableau. */
  tbody: Band | null;
}

/** Rend le HTML A4 autonome dans une iframe cachée puis le capture. */
async function renderHtmlToCanvas(html: string): Promise<Capture> {
  const { default: html2canvas } = await import("html2canvas");

  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  Object.assign(iframe.style, {
    position: "fixed",
    left: "-10000px",
    top: "0",
    width: `${RENDER_WIDTH_PX}px`,
    height: "1123px",
    border: "0",
    background: "#ffffff",
  });
  document.body.appendChild(iframe);

  const idoc = iframe.contentDocument;
  if (!idoc) {
    iframe.remove();
    throw new Error("iframe sans document");
  }
  idoc.open();
  idoc.write(html);
  idoc.close();

  // Attend le chargement du document, des images (logo/filigrane) et des
  // polices avant la capture, sinon le rendu peut être incomplet.
  await new Promise<void>((resolve) => {
    if (idoc.readyState === "complete") resolve();
    else iframe.addEventListener("load", () => resolve(), { once: true });
  });
  await Promise.all(
    Array.from(idoc.images).map((img) =>
      img.complete
        ? Promise.resolve()
        : new Promise<void>((r) => {
            img.addEventListener("load", () => r(), { once: true });
            img.addEventListener("error", () => r(), { once: true });
          }),
    ),
  );
  try {
    await (idoc as Document & { fonts?: FontFaceSet }).fonts?.ready;
  } catch {
    // Pas de FontFaceSet : on continue avec les polices système.
  }

  const target = (idoc.querySelector(".page") as HTMLElement | null) ?? idoc.body;
  try {
    // Relevé de la mise en page, pour paginer sans couper une ligne.
    const origin = target.getBoundingClientRect();
    const band = (el: Element | null): Band | null => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { top: r.top - origin.top, bottom: r.bottom - origin.top };
    };
    const blocks = Array.from(target.querySelectorAll("tbody tr, .content > *"))
      .map(band)
      .filter((b): b is Band => !!b && b.bottom > b.top);
    const contentBottom = Math.max(
      0,
      ...Array.from(target.querySelectorAll(".content > *")).map(
        (el) => band(el)?.bottom ?? 0,
      ),
    );

    const canvas = await html2canvas(target, {
      scale: CAPTURE_SCALE,
      useCORS: true,
      backgroundColor: "#ffffff",
      windowWidth: RENDER_WIDTH_PX,
    });
    return {
      canvas,
      widthPx: origin.width,
      contentBottom: contentBottom || origin.height,
      blocks,
      thead: band(target.querySelector("thead")),
      tbody: band(target.querySelector("tbody")),
    };
  } finally {
    iframe.remove();
  }
}

interface PageSlice {
  /** Tranche de la capture, en px CSS. */
  start: number;
  end: number;
  /** Décalage vertical de la tranche sur la page (marge + en-tête répété). */
  offset: number;
  /** Répéter l'en-tête du tableau en haut de la page. */
  repeatHeader: boolean;
}

/**
 * Découpe la capture en pages A4 en coupant uniquement ENTRE deux blocs
 * (jamais au milieu d'une ligne du tableau ou du panneau des totaux),
 * avec une marge en haut des pages de suite et l'en-tête du tableau
 * répété quand le tableau continue.
 */
function paginate(cap: Capture): PageSlice[] {
  const pxPerMm = cap.widthPx / A4_WIDTH_MM;
  const pageH = A4_HEIGHT_MM * pxPerMm;
  const bottomMargin = BOTTOM_MARGIN_MM * pxPerMm;
  const minLastBottom = MIN_LAST_BOTTOM_MM * pxPerMm;
  const theadH = cap.thead ? cap.thead.bottom - cap.thead.top : 0;

  const slices: PageSlice[] = [];
  let start = 0;
  let repeatHeader: boolean = false;

  // Garde-fou : jamais plus de 50 pages.
  while (slices.length < 50) {
    const first = slices.length === 0;
    const offset: number =
      (first ? 0 : CONTINUATION_TOP_MM * pxPerMm) + (repeatHeader ? theadH : 0);
    const room: number = pageH - offset;

    // Tout le reste tient sur cette page : c'est la dernière. Le padding
    // final de la page peut déborder sans créer de page blanche.
    if (cap.contentBottom - start <= room - minLastBottom) {
      slices.push({ start, end: start + room, offset, repeatHeader });
      break;
    }

    const avail: number = room - bottomMargin;
    let cut: number = start + avail;
    // Recule la coupe au début de tout bloc qu'elle traverserait.
    for (let moved = true; moved; ) {
      moved = false;
      for (const b of cap.blocks) {
        if (
          b.top < cut - 3 &&
          b.bottom > cut + 3 &&
          b.top - 2 > start + 1 &&
          b.bottom - b.top < avail
        ) {
          // 2 px de marge : html2canvas arrondit un peu différemment.
          cut = b.top - 2;
          moved = true;
        }
      }
    }
    // Aucun point de coupe propre : coupe franche plutôt qu'une page vide.
    if (cut <= start + 20) cut = start + avail;

    slices.push({ start, end: cut, offset, repeatHeader });
    repeatHeader =
      !!cap.thead &&
      !!cap.tbody &&
      cut > cap.tbody.top &&
      cut < cap.tbody.bottom - 1;
    start = cut;
  }
  return slices;
}

/** Convertit le HTML A4 autonome en Blob PDF (multi-pages si nécessaire). */
export async function htmlToPdfBlob(html: string): Promise<Blob> {
  const { jsPDF } = await import("jspdf");
  const cap = await renderHtmlToCanvas(html);
  const src = cap.canvas;
  // Rapport px du canvas / px CSS : l’échelle exacte, pas largeur canvas /
  // largeur CSS (le canvas est arrondi au px, ce qui ferait dériver les coupes).
  const k = CAPTURE_SCALE;
  const pageHeightPx = Math.round((A4_HEIGHT_MM * src.width) / A4_WIDTH_MM);

  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const slices = paginate(cap);

  slices.forEach((slice, i) => {
    const page = document.createElement("canvas");
    page.width = src.width;
    page.height = pageHeightPx;
    const ctx = page.getContext("2d");
    if (!ctx) throw new Error("canvas 2D indisponible");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, page.width, page.height);

    if (slice.repeatHeader && cap.thead) {
      const h = (cap.thead.bottom - cap.thead.top) * k;
      ctx.drawImage(src, 0, cap.thead.top * k, src.width, h, 0, slice.offset * k - h, src.width, h);
    }

    const sy = slice.start * k;
    const sh = Math.min((slice.end - slice.start) * k, src.height - sy);
    if (sh > 0) {
      ctx.drawImage(src, 0, sy, src.width, sh, 0, slice.offset * k, src.width, sh);
    }

    if (i > 0) pdf.addPage();
    pdf.addImage(page.toDataURL("image/jpeg", 0.92), "JPEG", 0, 0, A4_WIDTH_MM, A4_HEIGHT_MM);

    if (slices.length > 1) {
      pdf.setFontSize(8);
      pdf.setTextColor(148, 163, 184);
      pdf.text(`${i + 1} / ${slices.length}`, A4_WIDTH_MM - 15, A4_HEIGHT_MM - 5, {
        align: "right",
      });
    }
  });
  return pdf.output("blob");
}

/** Nettoie un libellé pour en faire un nom de fichier sûr. */
function safeFileName(name: string): string {
  const base = name
    .replace(/[^\p{L}\p{N}\-_ ]/gu, "")
    .trim()
    .replace(/\s+/g, "-");
  return `${base || "document"}.pdf`;
}

/** Télécharge le document en tant que fichier PDF réel. */
export async function downloadPdf(html: string, name: string): Promise<void> {
  const blob = await htmlToPdfBlob(html);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = safeFileName(name);
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export type ShareResult = "shared" | "unsupported" | "error";

export interface SharePdfOptions {
  html: string;
  /** Libellé du document — sert de nom de fichier (ex. « Devis DEV-2025-001 »). */
  name: string;
  /** Message texte accompagnant la pièce jointe. */
  text?: string;
}

/**
 * Partage le document en PIÈCE JOINTE PDF via le sélecteur natif
 * (WhatsApp, e-mail…). Renvoie :
 * - "shared"      : partage effectué (ou annulé par l'utilisateur) ;
 * - "unsupported" : l'appareil ne sait pas partager de fichier → l'appelant
 *                   retombe sur un lien wa.me texte ;
 * - "error"       : échec de génération du PDF.
 */
export async function sharePdf({
  html,
  name,
  text,
}: SharePdfOptions): Promise<ShareResult> {
  const fileName = safeFileName(name);
  const nav = navigator as Navigator & {
    canShare?: (data?: ShareData) => boolean;
  };

  let file: File;
  try {
    const blob = await htmlToPdfBlob(html);
    file = new File([blob], fileName, { type: "application/pdf" });
  } catch {
    return "error";
  }

  if (nav.canShare && nav.canShare({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: fileName, text });
      return "shared";
    } catch (error) {
      // L'utilisateur a annulé : ne pas retomber sur le lien texte.
      if (error instanceof DOMException && error.name === "AbortError") {
        return "shared";
      }
      return "error";
    }
  }
  return "unsupported";
}
