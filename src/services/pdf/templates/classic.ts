/**
 * Modèle « classic » — reprend le modèle du prototype :
 * en-tête couleur entreprise, tableau réglementaire, totaux à droite,
 * mentions OHADA, bloc signature.
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

export const classicTemplate: PdfTemplate = {
  id: "classic",

  render(doc: PdfDocumentData, company: PdfCompany, s: PdfStrings): string {
    const color = company.color || "#131F35";
    const titleWord =
      doc.type === "facture"
        ? s.invoice
        : doc.type === "proforma"
          ? s.proforma
          : s.quote;
    const net = doc.subtotal - doc.discount;
    const remaining = Math.max(doc.total - doc.advanceAmount, 0);

    const logo = company.logoUrl
      ? `<img src="${esc(company.logoUrl)}" alt="" style="width:52px;height:52px;object-fit:contain;border-radius:10px" />`
      : `<div style="width:52px;height:52px;border-radius:12px;background:${color};color:#fff;display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:800">${esc((company.name || "D").charAt(0).toUpperCase())}</div>`;

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
      <tr style="background:${i % 2 === 1 ? "#F6F7F9" : "#fff"}">
        <td style="padding:8px 10px;font-size:12px;color:#131F35">${esc(line.name)}</td>
        <td style="padding:8px 10px;font-size:12px;color:#5A6377;text-align:center">${line.quantity} ${esc(line.unit)}</td>
        <td style="padding:8px 10px;font-size:12px;color:#5A6377;text-align:right">${fcfa(line.unitPrice)}</td>
        <td style="padding:8px 10px;font-size:12px;font-weight:600;color:#131F35;text-align:right">${fcfa(line.lineTotal)}</td>
      </tr>`,
      )
      .join("");

    const discountRow =
      doc.discount > 0
        ? `<div style="display:flex;justify-content:space-between;font-size:12px;color:#5A6377;padding:3px 0"><span>${s.discount}</span><span>− ${fcfa(doc.discount)}</span></div>`
        : "";

    const vatRows =
      doc.vatRate > 0
        ? `<div style="display:flex;justify-content:space-between;font-size:12px;color:#5A6377;padding:3px 0"><span>${s.netAmount}</span><span>${fcfa(net)}</span></div>
           <div style="display:flex;justify-content:space-between;font-size:12px;color:#5A6377;padding:3px 0"><span>${s.vat} ${doc.vatRate}%</span><span>${fcfa(doc.vatAmount)}</span></div>`
        : "";

    const vatNa =
      doc.vatRate === 0
        ? `<div style="font-size:10px;color:#8A93A6;font-style:italic;margin-top:6px">${s.vatNa}</div>`
        : "";

    const totalLabel = doc.vatRate > 0 ? s.totalTtc : s.total;

    const advanceRows =
      doc.advanceAmount > 0
        ? `<div style="display:flex;justify-content:space-between;font-size:12px;color:#5A6377;padding:3px 0"><span>${s.advance}</span><span>− ${fcfa(doc.advanceAmount)}</span></div>
           <div style="display:flex;justify-content:space-between;font-size:13px;font-weight:800;color:${color};padding:5px 0"><span>${s.remaining}</span><span>${fcfa(remaining)}</span></div>`
        : "";

    const conditions = doc.conditions
      ? `<div style="margin-top:14px"><div style="font-size:10px;font-weight:700;color:#8A93A6;text-transform:uppercase;letter-spacing:.06em">${s.conditions}</div><div style="font-size:11px;color:#5A6377;margin-top:3px">${esc(doc.conditions)}</div></div>`
      : "";

    const note = doc.note
      ? `<div style="margin-top:10px;font-size:11px;color:#5A6377">${esc(doc.note)}</div>`
      : "";

    const accord =
      doc.type !== "facture"
        ? `<div style="text-align:center"><div style="font-size:10px;font-weight:700;color:#8A93A6;text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px">${s.approval}</div><div style="width:150px;border-bottom:1px solid #C3C9D5;height:44px"></div><div style="font-size:9.5px;color:#5A6377;margin-top:4px">${s.approvalDate}</div></div>`
        : "";

    const legalNote = doc.type === "facture" ? s.latePenalty : s.quoteValidity;

    return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<title>${esc(doc.number)}</title>
<style>
  @page { size: A4; margin: 0; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Poppins', -apple-system, 'Segoe UI', sans-serif; background: #fff; }
  .page { width: 210mm; min-height: 297mm; padding: 18mm 16mm; margin: 0 auto; display: flex; flex-direction: column; }
  @media print { .page { width: auto; min-height: auto; } }
</style>
</head>
<body>
<div class="page">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid ${color};padding-bottom:14px;margin-bottom:18px">
    <div style="display:flex;gap:12px;align-items:center">
      ${logo}
      <div>
        <div style="font-size:16px;font-weight:800;color:#131F35">${esc(company.name)}</div>
        ${company.slogan ? `<div style="font-size:10px;font-style:italic;color:${color}">${esc(company.slogan)}</div>` : ""}
        <div style="font-size:10.5px;color:#5A6377;line-height:1.5;margin-top:2px">${[company.address, company.phone, company.email].filter(Boolean).map(esc).join("<br/>")}</div>
      </div>
    </div>
    <div style="text-align:right">
      <div style="font-size:24px;font-weight:800;color:${color};letter-spacing:.04em">${titleWord}</div>
      <div style="font-size:11px;color:#8A93A6;font-weight:600">N° ${esc(doc.number)}</div>
      <div style="font-size:9px;color:#8A93A6;text-transform:uppercase;letter-spacing:.06em;margin-top:8px">${s.date}</div>
      <div style="font-size:12px;font-weight:600;color:#131F35">${frDate(doc.issueDate)}</div>
    </div>
  </div>

  ${doc.title ? `<div style="font-size:13px;font-weight:600;color:#131F35;margin-bottom:12px">${esc(doc.title)}</div>` : ""}

  <div style="background:#F6F7F9;border-radius:8px;padding:10px 14px;margin-bottom:16px">
    <div style="font-size:9px;color:#8A93A6;text-transform:uppercase;letter-spacing:.06em">${s.client}</div>
    <div style="font-size:13px;font-weight:700;color:#131F35">${esc(doc.clientName || "—")}</div>
    ${doc.clientPhone ? `<div style="font-size:11px;color:#5A6377">${esc(doc.clientPhone)}</div>` : ""}
  </div>

  <table style="width:100%;border-collapse:collapse">
    <thead>
      <tr style="background:${color};color:#fff">
        <th style="padding:9px 10px;font-size:10.5px;text-transform:uppercase;letter-spacing:.05em;text-align:left">${s.designation}</th>
        <th style="padding:9px 10px;font-size:10.5px;text-transform:uppercase;letter-spacing:.05em;text-align:center">${s.qty}</th>
        <th style="padding:9px 10px;font-size:10.5px;text-transform:uppercase;letter-spacing:.05em;text-align:right">${s.unitPrice}</th>
        <th style="padding:9px 10px;font-size:10.5px;text-transform:uppercase;letter-spacing:.05em;text-align:right">${s.total}</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>

  <div style="display:flex;justify-content:flex-end;margin-top:14px">
    <div style="width:240px">
      <div style="display:flex;justify-content:space-between;font-size:12px;color:#5A6377;padding:3px 0"><span>${s.subtotal}</span><span>${fcfa(doc.subtotal)}</span></div>
      ${discountRow}
      ${vatRows}
      <div style="display:flex;justify-content:space-between;font-size:14px;font-weight:800;background:${color};color:#fff;padding:9px 12px;border-radius:6px;margin-top:5px"><span>${totalLabel}</span><span>${fcfa(doc.total)}</span></div>
      ${advanceRows}
    </div>
  </div>

  ${conditions}
  ${note}

  <div style="display:flex;justify-content:space-between;align-items:flex-end;margin-top:auto;padding-top:34px;gap:20px">
    <div style="flex:1;font-size:9.5px;color:#8A93A6;line-height:1.5">
      <div>${legalNote}</div>
      ${legalBits ? `<div style="margin-top:4px">${legalBits}</div>` : ""}
      ${vatNa}
    </div>
    ${accord}
    <div style="text-align:center">
      <div style="width:150px;border-bottom:1px solid #C3C9D5;height:44px"></div>
      <div style="font-size:9.5px;color:#5A6377;margin-top:4px">${esc(company.ownerName || company.name)} · ${s.signature}</div>
    </div>
  </div>

  <div style="text-align:center;font-size:9px;color:#B4BAC7;margin-top:18px">${s.footer}</div>
</div>
</body>
</html>`;
  },
};
