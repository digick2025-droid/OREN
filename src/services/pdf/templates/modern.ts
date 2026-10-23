/**
 * Modèle « modern » — grand bandeau pleine largeur à la couleur de
 * l'entreprise, logo posé sur une pastille blanche (un JPEG à fond
 * blanc ne fait pas « trou »), client et document en deux cartes,
 * tableau à lignes alternées, total en bandeau.
 */

import type { PdfCompany, PdfDocumentData, PdfStrings, PdfTemplate } from "../types";
import {
  amountStatement,
  buildTheme,
  buildTotals,
  conditionsAndNote,
  contactLines,
  descriptionBlock,
  documentEnd,
  esc,
  eyebrow,
  fcfa,
  frDate,
  logoBox,
  pageShell,
  sortedLines,
  titleWord,
  totalRowHtml,
  watermark,
} from "../theme";

export const modernTemplate: PdfTemplate = {
  id: "modern",

  render(doc: PdfDocumentData, company: PdfCompany, s: PdfStrings): string {
    const theme = buildTheme(company.color);
    const branded = company.premiumBranding && !!company.logoUrl;
    const totals = buildTotals(doc, s);
    const onBrandSoft =
      theme.onBrand === "#FFFFFF" ? "rgba(255,255,255,.82)" : "rgba(15,23,42,.72)";

    const logo = company.logoUrl
      ? `<div style="padding:8px 10px;border-radius:14px;background:#fff;box-shadow:0 1px 3px rgba(15,23,42,.12)">${logoBox(company.logoUrl, { width: 150, height: 52 })}</div>`
      : `<div style="width:56px;height:56px;flex-shrink:0;border-radius:14px;background:#fff;color:${theme.ink};display:flex;align-items:center;justify-content:center;font-size:24px;font-weight:800">${esc((company.name || "D").charAt(0).toUpperCase())}</div>`;

    const rows = sortedLines(doc)
      .map(
        (line, i) => `
      <tr style="background:${i % 2 === 1 ? theme.soft : "#fff"}">
        <td style="padding:9px 12px;font-size:12px;font-weight:500;color:#0F172A">${esc(line.name)}</td>
        <td style="padding:9px 12px;font-size:12px;color:#475569;text-align:center;white-space:nowrap">${line.quantity} ${esc(line.unit)}</td>
        <td style="padding:9px 12px;font-size:12px;color:#475569;text-align:right;white-space:nowrap">${fcfa(line.unitPrice)}</td>
        <td style="padding:9px 12px;font-size:12px;font-weight:700;color:#0F172A;text-align:right;white-space:nowrap">${fcfa(line.lineTotal)}</td>
      </tr>`,
      )
      .join("");

    const th = (label: string, align: string) =>
      `<th style="padding:9px 12px;font-size:9.5px;font-weight:800;color:${theme.ink};text-transform:uppercase;letter-spacing:.08em;text-align:${align};border-bottom:2px solid ${theme.brand}">${label}</th>`;

    const card = (content: string) =>
      `<div style="flex:1;border:1px solid #E2E8F0;border-radius:12px;padding:11px 14px">${content}</div>`;

    const advance = totals.advance
      ? totalRowHtml(totals.advance) +
        `<div style="display:flex;justify-content:space-between;font-size:13px;font-weight:800;color:${theme.ink};padding:7px 12px;border:1.5px solid ${theme.brand};border-radius:10px;margin-top:6px"><span>${totals.remaining!.label}</span><span style="font-variant-numeric:tabular-nums">${totals.remaining!.value}</span></div>`
      : "";

    const body = `
  ${watermark(company, branded)}
  <div class="content">

  <div style="margin:0 -15mm 18px;padding:12mm 15mm 9mm;background:linear-gradient(120deg,${theme.brand},${theme.brandAlt});color:${theme.onBrand};display:flex;justify-content:space-between;align-items:center;gap:18px">
    <div style="display:flex;gap:14px;align-items:center;min-width:0">
      ${logo}
      <div style="min-width:0">
        <div style="font-size:18px;font-weight:800;letter-spacing:-.01em">${esc(company.name)}</div>
        ${company.slogan ? `<div style="font-size:10px;font-style:italic;color:${onBrandSoft};margin-top:1px">${esc(company.slogan)}</div>` : ""}
        <div style="font-size:9.5px;color:${onBrandSoft};line-height:1.55;margin-top:4px">${contactLines(company).join(" · ")}</div>
      </div>
    </div>
    <div style="text-align:right;flex-shrink:0">
      <div style="font-size:26px;font-weight:800;letter-spacing:.04em">${titleWord(doc, s)}</div>
      <div style="font-size:11px;font-weight:700;color:${onBrandSoft};margin-top:2px">N° ${esc(doc.number)}</div>
    </div>
  </div>

  <div style="display:flex;gap:12px;margin-bottom:16px">
    ${card(`${eyebrow(s.client, theme.ink)}
      <div style="font-size:13.5px;font-weight:700;color:#0F172A;margin-top:3px">${esc(doc.clientName || "—")}</div>
      ${doc.clientPhone ? `<div style="font-size:11px;color:#64748B;margin-top:1px">${esc(doc.clientPhone)}</div>` : ""}`)}
    ${card(`${eyebrow(s.date, theme.ink)}
      <div style="font-size:13.5px;font-weight:700;color:#0F172A;margin-top:3px">${frDate(doc.issueDate)}</div>
      ${doc.title ? `<div style="font-size:11px;color:#64748B;margin-top:1px">${esc(doc.title)}</div>` : ""}`)}
  </div>

  ${descriptionBlock(doc, theme, s)}

  <div>
    <table style="width:100%;border-collapse:collapse">
      <thead>
        <tr>${th(s.designation, "left")}${th(s.qty, "center")}${th(s.unitPrice, "right")}${th(s.total, "right")}</tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  </div>

  <div style="display:flex;justify-content:flex-end;margin-top:14px">
    <div style="width:270px;padding:0 2px">
      ${totals.rows.map((row) => totalRowHtml(row)).join("")}
      <div style="display:flex;justify-content:space-between;align-items:center;font-size:15px;font-weight:800;background:${theme.brand};color:${theme.onBrand};padding:11px 14px;border-radius:10px;margin-top:8px"><span>${totals.totalLabel}</span><span style="font-variant-numeric:tabular-nums">${totals.total}</span></div>
      ${advance}
    </div>
  </div>

  ${amountStatement(doc, s)}
  ${conditionsAndNote(doc, theme, s)}

  ${documentEnd(doc, company, theme, s, totals.vatNa, branded)}
  </div>`;

    return pageShell(doc.number, body, { padding: "0 15mm 12mm", verticalPaddingMm: 12 });
  },
};
