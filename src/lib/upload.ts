/**
 * OREN · Validation & compression d'upload de logo (côté client, zéro dépendance).
 *
 * Contrôles appliqués :
 *  - taille ≤ 2 Mo (avant compression) ;
 *  - vérification du MIME *réel* via les octets de signature (magic bytes),
 *    pas seulement l'extension ni le `file.type` déclaré par le navigateur ;
 *  - SVG interdit (vecteur = risque XSS/script embarqué) ;
 *  - compression/redimensionnement via le canvas natif du navigateur.
 */

export const MAX_LOGO_BYTES = 2 * 1024 * 1024; // 2 Mo

/** Types réellement acceptés pour un logo. */
export const ACCEPTED_LOGO_MIME = [
  "image/png",
  "image/jpeg",
  "image/webp",
] as const;

export type AcceptedLogoMime = (typeof ACCEPTED_LOGO_MIME)[number];

/** Attribut `accept` à utiliser sur l'input file. */
export const LOGO_ACCEPT_ATTR = ACCEPTED_LOGO_MIME.join(",");

/** Côté le plus long de l'image après compression (px). */
const MAX_LOGO_DIMENSION = 512;
/**
 * Côté le plus long d'une capture d'écran de témoignage : plus grand
 * qu'un logo, sinon le texte de la capture (message WhatsApp, avis…)
 * devient illisible une fois compressé.
 */
const MAX_TESTIMONIAL_DIMENSION = 1280;
/** Qualité JPEG/WebP à l'export (0–1). */
const OUTPUT_QUALITY = 0.85;

export type LogoErrorCode =
  | "too_large"
  | "svg_forbidden"
  | "unsupported_type"
  | "read_failed"
  | "decode_failed";

/** Messages FR prêts à afficher (toast). `too_large` est calculé par appelant (limite variable). */
export const LOGO_ERROR_MESSAGES: Record<LogoErrorCode, string> = {
  too_large: "Image trop lourde.",
  svg_forbidden: "Les fichiers SVG ne sont pas autorisés.",
  unsupported_type: "Format non pris en charge. Utilisez PNG, JPEG ou WebP.",
  read_failed: "Lecture du fichier impossible. Réessayez.",
  decode_failed: "Image illisible ou corrompue.",
};

export type PrepareLogoResult =
  | { ok: true; file: File }
  | { ok: false; code: LogoErrorCode; message: string };

function fail(code: LogoErrorCode, message?: string): PrepareLogoResult {
  return { ok: false, code, message: message ?? LOGO_ERROR_MESSAGES[code] };
}

/**
 * Détecte le type MIME réel à partir des octets de signature.
 * Retourne `"image/svg+xml"` si le contenu ressemble à du SVG (texte),
 * ou `null` si aucune signature connue ne correspond.
 */
async function sniffRealMime(file: File): Promise<string | null> {
  const header = new Uint8Array(await file.slice(0, 32).arrayBuffer());

  const startsWith = (sig: number[], offset = 0) =>
    sig.every((byte, i) => header[offset + i] === byte);

  // PNG : 89 50 4E 47 0D 0A 1A 0A
  if (startsWith([0x89, 0x50, 0x4e, 0x47])) return "image/png";
  // JPEG : FF D8 FF
  if (startsWith([0xff, 0xd8, 0xff])) return "image/jpeg";
  // WEBP : "RIFF" .... "WEBP"
  if (startsWith([0x52, 0x49, 0x46, 0x46]) && startsWith([0x57, 0x45, 0x42, 0x50], 8))
    return "image/webp";
  // GIF : "GIF8"
  if (startsWith([0x47, 0x49, 0x46, 0x38])) return "image/gif";

  // SVG / XML : contenu texte. On lève un début de fichier décodé en UTF-8.
  const text = new TextDecoder("utf-8")
    .decode(header)
    .replace(/^﻿/, "")
    .trimStart()
    .toLowerCase();
  if (text.startsWith("<?xml") || text.startsWith("<svg")) return "image/svg+xml";

  return null;
}

/**
 * Compresse/redimensionne une image via canvas.
 * Retombe sur le fichier d'origine si le canvas n'est pas disponible
 * ou si l'encodage échoue.
 */
async function compressImage(
  file: File,
  mime: AcceptedLogoMime,
  maxDimension: number,
): Promise<File> {
  // Environnement sans DOM (SSR/test) : on ne compresse pas.
  if (typeof document === "undefined" || typeof createImageBitmap === "undefined") {
    return file;
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return file; // décodage impossible via bitmap : on garde l'original
  }

  const { width, height } = bitmap;
  const scale = Math.min(1, maxDimension / Math.max(width, height));
  const targetW = Math.max(1, Math.round(width * scale));
  const targetH = Math.max(1, Math.round(height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    return file;
  }
  ctx.drawImage(bitmap, 0, 0, targetW, targetH);
  bitmap.close();

  // PNG conserve la transparence ; le reste part en WebP (bon ratio).
  const outMime: AcceptedLogoMime = mime === "image/png" ? "image/png" : "image/webp";

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, outMime, OUTPUT_QUALITY),
  );
  if (!blob) return file;

  // Si la compression n'a rien gagné, on garde l'original.
  if (blob.size >= file.size) return file;

  const ext = outMime === "image/png" ? "png" : "webp";
  const baseName = file.name.replace(/\.[^.]+$/, "") || "logo";
  return new File([blob], `${baseName}.${ext}`, {
    type: outMime,
    lastModified: Date.now(),
  });
}

/** Contrôles communs (taille, MIME réel) partagés par tous les uploads d'image. */
async function validate(
  file: File,
  maxBytes: number,
): Promise<{ ok: true; mime: AcceptedLogoMime } | { ok: false; result: PrepareLogoResult }> {
  if (file.size > maxBytes) {
    const maxMo = Math.round(maxBytes / (1024 * 1024));
    return { ok: false, result: fail("too_large", `Image trop lourde (${maxMo} Mo maximum).`) };
  }

  let realMime: string | null;
  try {
    realMime = await sniffRealMime(file);
  } catch {
    return { ok: false, result: fail("read_failed") };
  }

  if (realMime === "image/svg+xml") return { ok: false, result: fail("svg_forbidden") };
  if (!realMime) return { ok: false, result: fail("decode_failed") };
  if (!ACCEPTED_LOGO_MIME.includes(realMime as AcceptedLogoMime)) {
    return { ok: false, result: fail("unsupported_type") };
  }

  return { ok: true, mime: realMime as AcceptedLogoMime };
}

/**
 * Valide puis (si possible) compresse le logo choisi par l'utilisateur.
 * À appeler avant tout upload vers le stockage.
 */
export async function prepareLogo(file: File): Promise<PrepareLogoResult> {
  const check = await validate(file, MAX_LOGO_BYTES);
  if (!check.ok) return check.result;
  const compressed = await compressImage(file, check.mime, MAX_LOGO_DIMENSION);
  return { ok: true, file: compressed };
}

/** Taille max d'une capture d'écran de témoignage, avant compression. */
export const MAX_TESTIMONIAL_IMAGE_BYTES = 5 * 1024 * 1024; // 5 Mo

/** Attribut `accept` à utiliser sur l'input file d'un témoignage. */
export const TESTIMONIAL_IMAGE_ACCEPT_ATTR = ACCEPTED_LOGO_MIME.join(",");

/**
 * Valide puis (si possible) compresse la capture d'écran d'un témoignage.
 * Même pipeline que le logo, mais avec une résolution de sortie plus
 * grande : le texte de la capture doit rester lisible.
 */
export async function prepareTestimonialImage(file: File): Promise<PrepareLogoResult> {
  const check = await validate(file, MAX_TESTIMONIAL_IMAGE_BYTES);
  if (!check.ok) return check.result;
  const compressed = await compressImage(file, check.mime, MAX_TESTIMONIAL_DIMENSION);
  return { ok: true, file: compressed };
}
