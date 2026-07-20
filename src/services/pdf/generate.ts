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

/** Rend le HTML A4 autonome dans une iframe cachée puis le capture. */
async function renderHtmlToCanvas(html: string): Promise<HTMLCanvasElement> {
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
    return await html2canvas(target, {
      scale: 2,
      useCORS: true,
      backgroundColor: "#ffffff",
      windowWidth: RENDER_WIDTH_PX,
    });
  } finally {
    iframe.remove();
  }
}

/** Convertit le HTML A4 autonome en Blob PDF (multi-pages si nécessaire). */
export async function htmlToPdfBlob(html: string): Promise<Blob> {
  const { jsPDF } = await import("jspdf");
  const canvas = await renderHtmlToCanvas(html);

  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const imgData = canvas.toDataURL("image/jpeg", 0.95);
  const imgWidth = A4_WIDTH_MM;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;

  let heightLeft = imgHeight;
  let position = 0;
  pdf.addImage(imgData, "JPEG", 0, position, imgWidth, imgHeight);
  heightLeft -= A4_HEIGHT_MM;
  while (heightLeft > 0) {
    position -= A4_HEIGHT_MM;
    pdf.addPage();
    pdf.addImage(imgData, "JPEG", 0, position, imgWidth, imgHeight);
    heightLeft -= A4_HEIGHT_MM;
  }
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
