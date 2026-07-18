/**
 * Modèle « classic » — rendu premium :
 * bandeau dégradé couleur entreprise, en-tête aéré, tableau encadré,
 * totaux en panneau teinté, mentions OHADA, bloc signature.
 * Avec l'offre Startup (logo chargé), le document passe en branding
 * complet : filigrane du logo, en-tête magnifié, pied de page à
 * l'image de l'entreprise.
 */

import type {
  PdfCompany,
  PdfDocumentData,
  PdfStrings,
  PdfTemplate,
} from "../types";

function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fcfa(value: number): string {
  return (
    Math.round(value || 0)
      .toLocaleString("fr-FR")
      .replace(/[  ]/g, " ") + " FCFA"
  );
}

function frDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/** Teinte dérivée de la couleur de marque (hex 6 chiffres + alpha hex). */
function tint(hex: string, alpha: string): string {
  return /^#[0-9a-fA-F]{6}$/.test(hex) ? `${hex}${alpha}` : hex;
}

export const classicTemplate: PdfTemplate = {
  id: "classic",

  render(doc: PdfDocumentData, company: PdfCompany, s: PdfStrings): string {
    const color = company.color || "#0F172A";
    const soft = tint(color, "0D"); // fond très léger (~5 %)
    const softBorder = tint(color, "33"); // bordure légère (~20 %)
    const branded = company.premiumBranding && !!company.logoUrl;

    const titleWord =
      doc.type === "facture"
        ? s.invoice
        : doc.type === "proforma"
          ? s.proforma
          : s.quote;
    const net = doc.subtotal - doc.discount;
    const remaining = Math.max(doc.total - doc.advanceAmount, 0);

    const logoSize = branded ? 64 : 52;
    const logo = company.logoUrl
      ? `<img src="${esc(company.logoUrl)}" alt="" style="width:${logoSize}px;height:${logoSize}px;object-fit:contain;border-radius:12px${branded ? `;padding:5px;background:#fff;border:1px solid ${softBorder};box-shadow:0 1px 4px rgba(15,23,42,.06)` : ""}" />`
      : `<div style="width:52px;height:52px;border-radius:12px;background:linear-gradient(135deg,${color},${tint(color, "CC")});color:#fff;display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:800">${esc((company.name || "D").charAt(0).toUpperCase())}</div>`;

    // Filigrane Startup : le logo en très grand, à peine visible, centré
    const watermark = branded
      ? `<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;z-index:0;pointer-events:none">
           <img src="${esc(company.logoUrl)}" alt="" style="width:105mm;max-height:105mm;object-fit:contain;opacity:.045" />
         </div>`
      : "";

    const legalBits = [
      company.rccm ? `RCCM ${esc(company.rccm)}` : "",
      company.nif ? `NIF ${esc(company.nif)}` : "",
      company.taxRegime ? `${s.regime} ${esc(company.taxRegime)}` : "",
    ]
      .filter(Boolean)
      .join(" · ");

    const rows = doc.lines
      .map(
        (line, i) => `
      <tr>
        <td style="padding:10px 12px;font-size:12px;font-weight:500;color:#0F172A;border-top:${i === 0 ? "none" : "1px solid #F1F5F9"}">${esc(line.name)}</td>
        <td style="padding:10px 12px;font-size:12px;color:#475569;text-align:center;border-top:${i === 0 ? "none" : "1px solid #F1F5F9"};white-space:nowrap">${line.quantity} ${esc(line.unit)}</td>
        <td style="padding:10px 12px;font-size:12px;color:#475569;text-align:right;border-top:${i === 0 ? "none" : "1px solid #F1F5F9"};white-space:nowrap">${fcfa(line.unitPrice)}</td>
        <td style="padding:10px 12px;font-size:12px;font-weight:700;color:#0F172A;text-align:right;border-top:${i === 0 ? "none" : "1px solid #F1F5F9"};white-space:nowrap">${fcfa(line.lineTotal)}</td>
      </tr>`,
      )
      .join("");

    const totalLine = (label: string, value: string, minus = false) =>
      `<div style="display:flex;justify-content:space-between;font-size:12px;color:#475569;padding:4px 0"><span>${label}</span><span style="font-variant-numeric:tabular-nums">${minus ? "− " : ""}${value}</span></div>`;

    const discountRow =
      doc.discount > 0 ? totalLine(s.discount, fcfa(doc.discount), true) : "";

    const vatRows =
      doc.vatRate > 0
        ? totalLine(s.netAmount, fcfa(net)) +
          totalLine(`${s.vat} ${doc.vatRate}%`, fcfa(doc.vatAmount))
        : "";

    const vatNa =
      doc.vatRate === 0
        ? `<div style="font-size:10px;color:#94A3B8;font-style:italic;margin-top:6px">${s.vatNa}</div>`
        : "";

    const totalLabel = doc.vatRate > 0 ? s.totalTtc : s.total;

    const advanceRows =
      doc.advanceAmount > 0
        ? totalLine(s.advance, fcfa(doc.advanceAmount), true) +
          `<div style="display:flex;justify-content:space-between;font-size:13px;font-weight:800;color:${color};padding:6px 12px;background:${soft};border-radius:8px;margin-top:4px"><span>${s.remaining}</span><span style="font-variant-numeric:tabular-nums">${fcfa(remaining)}</span></div>`
        : "";

    const conditions = doc.conditions
      ? `<div style="margin-top:16px"><div style="font-size:9.5px;font-weight:700;color:${color};text-transform:uppercase;letter-spacing:.08em">${s.conditions}</div><div style="font-size:11px;color:#475569;margin-top:4px;line-height:1.55">${esc(doc.conditions)}</div></div>`
      : "";

    const note = doc.note
      ? `<div style="margin-top:10px;font-size:11px;color:#475569;line-height:1.55">${esc(doc.note)}</div>`
      : "";

    const accord =
      doc.type !== "facture"
        ? `<div style="text-align:center"><div style="font-size:9.5px;font-weight:700;color:#94A3B8;text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px">${s.approval}</div><div style="width:150px;border-bottom:1.5px solid #CBD5E1;height:44px"></div><div style="font-size:9.5px;color:#64748B;margin-top:5px">${s.approvalDate}</div></div>`
        : "";

    const legalNote = doc.type === "facture" ? s.latePenalty : s.quoteValidity;

    // Pied de page : branding entreprise en Startup, sinon mention OREN centrée
    const footer = branded
      ? `<div style="display:flex;justify-content:space-between;align-items:center;border-top:1px solid #E2E8F0;margin-top:18px;padding-top:10px">
           <div style="display:flex;align-items:center;gap:8px">
             <img src="${esc(company.logoUrl)}" alt="" style="width:18px;height:18px;object-fit:contain;border-radius:4px" />
             <span style="font-size:9.5px;font-weight:700;color:#0F172A">${esc(company.name)}</span>
             ${company.slogan ? `<span style="font-size:9px;color:#94A3B8">· ${esc(company.slogan)}</span>` : ""}
           </div>
           <div style="font-size:8.5px;color:#CBD5E1">${s.footer}</div>
         </div>`
      : `<div style="text-align:center;font-size:9px;color:#94A3B8;border-top:1px solid #E2E8F0;margin-top:18px;padding-top:10px">${s.footer}</div>`;

    const slogan = company.slogan
      ? branded
        ? `<div style="display:inline-block;font-size:9.5px;font-weight:600;color:${color};background:${soft};border-radius:999px;padding:2px 9px;margin-top:3px">${esc(company.slogan)}</div>`
        : `<div style="font-size:10px;font-style:italic;color:${color};margin-top:1px">${esc(company.slogan)}</div>`
      : "";

    return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<title>${esc(doc.number)}</title>
<style>
  @page { size: A4; margin: 0; }
  * { margin: 0; padding: 0; box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { font-family: 'Inter', -apple-system, 'Segoe UI', sans-serif; background: #fff; color: #0F172A; }
  .page { width: 210mm; min-height: 297mm; padding: 16mm 15mm 12mm; margin: 0 auto; position: relative; }
  .content { position: relative; z-index: 1; display: flex; flex-direction: column; min-height: calc(297mm - 28mm); }
  @media print { .page { width: auto; min-height: auto; } .content { min-height: calc(297mm - 28mm); } }
</style>
</head>
<body>
<div class="page">
  ${watermark}
  <div class="content">

  <div style="height:5px;border-radius:999px;background:linear-gradient(90deg,${color},${tint(color, "66")});margin-bottom:16px"></div>

  <div style="display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:16px;border-bottom:1px solid #E2E8F0;margin-bottom:18px">
    <div style="display:flex;gap:14px;align-items:center">
      ${logo}
      <div>
        <div style="font-size:${branded ? "18px" : "16px"};font-weight:800;color:#0F172A;letter-spacing:-.01em">${esc(company.name)}</div>
        ${slogan}
        <div style="font-size:10px;color:#64748B;line-height:1.55;margin-top:3px">${[company.address, company.phone, company.email].filter(Boolean).map(esc).join("<br/>")}</div>
      </div>
    </div>
    <div style="text-align:right">
      <div style="font-size:23px;font-weight:800;color:${color};letter-spacing:.03em">${titleWord}</div>
      <div style="display:inline-block;font-size:10.5px;font-weight:700;color:${color};background:${soft};border:1px solid ${softBorder};border-radius:999px;padding:2px 10px;margin-top:4px">N° ${esc(doc.number)}</div>
      <div style="font-size:8.5px;color:#94A3B8;text-transform:uppercase;letter-spacing:.08em;margin-top:9px">${s.date}</div>
      <div style="font-size:12px;font-weight:600;color:#0F172A">${frDate(doc.issueDate)}</div>
    </div>
  </div>

  ${doc.title ? `<div style="font-size:13px;font-weight:700;color:#0F172A;margin-bottom:12px">${esc(doc.title)}</div>` : ""}

  <div style="background:${soft};border-left:3px solid ${color};border-radius:8px;padding:10px 14px;margin-bottom:16px">
    <div style="font-size:8.5px;font-weight:700;color:${color};text-transform:uppercase;letter-spacing:.08em">${s.client}</div>
    <div style="font-size:13px;font-weight:700;color:#0F172A;margin-top:1px">${esc(doc.clientName || "—")}</div>
    ${doc.clientPhone ? `<div style="font-size:11px;color:#64748B">${esc(doc.clientPhone)}</div>` : ""}
  </div>

  <div style="border:1px solid #E2E8F0;border-radius:10px;overflow:hidden">
    <table style="width:100%;border-collapse:collapse">
      <thead>
        <tr style="background:${color};color:#fff">
          <th style="padding:10px 12px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;text-align:left">${s.designation}</th>
          <th style="padding:10px 12px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;text-align:center">${s.qty}</th>
          <th style="padding:10px 12px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;text-align:right">${s.unitPrice}</th>
          <th style="padding:10px 12px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;text-align:right">${s.total}</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  </div>

  <div style="display:flex;justify-content:flex-end;margin-top:16px">
    <div style="width:260px;background:#F8FAFC;border:1px solid #EEF2F7;border-radius:12px;padding:12px 14px">
      ${totalLine(s.subtotal, fcfa(doc.subtotal))}
      ${discountRow}
      ${vatRows}
      <div style="display:flex;justify-content:space-between;align-items:center;font-size:14px;font-weight:800;background:linear-gradient(135deg,${color},${tint(color, "E6")});color:#fff;padding:10px 14px;border-radius:9px;margin-top:6px;box-shadow:0 2px 6px ${tint(color, "40")}"><span>${totalLabel}</span><span style="font-variant-numeric:tabular-nums">${fcfa(doc.total)}</span></div>
      ${advanceRows}
    </div>
  </div>

  ${conditions}
  ${note}

  <div style="display:flex;justify-content:space-between;align-items:flex-end;margin-top:auto;padding-top:34px;gap:20px">
    <div style="flex:1;font-size:9.5px;color:#94A3B8;line-height:1.6">
      <div>${legalNote}</div>
      ${legalBits ? `<div style="margin-top:4px;font-weight:600;color:#64748B">${legalBits}</div>` : ""}
      ${vatNa}
    </div>
    ${accord}
    <div style="text-align:center">
      <div style="width:150px;border-bottom:1.5px solid #CBD5E1;height:44px"></div>
      <div style="font-size:9.5px;color:#64748B;margin-top:5px">${esc(company.ownerName || company.name)} · ${s.signature}</div>
    </div>
  </div>

  ${footer}
  </div>
</div>
</body>
</html>`;
  },
};
