/**
 * Modèle « classic » — rendu premium :
 * bandeau dégradé couleur entreprise, en-tête aéré, tableau encadré,
 * totaux en panneau teinté, mentions OHADA, bloc signature.
 * Avec l'offre Startup (logo chargé), le document passe en branding
 * complet : filigrane du logo, en-tête magnifié, pied de page à
 * l'image de l'entreprise.
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
  fcfa,
  frDate,
  logoBox,
  monogram,
  pageShell,
  sortedLines,
  titleWord,
  totalRowHtml,
  watermark,
} from "../theme";

export const classicTemplate: PdfTemplate = {
  id: "classic",

  render(doc: PdfDocumentData, company: PdfCompany, s: PdfStrings): string {
    const theme = buildTheme(company.color);
    const branded = company.premiumBranding && !!company.logoUrl;
    const totals = buildTotals(doc, s);

    // Logo cadré selon sa forme : large pour un logo horizontal, compact
    // pour un logo carré (boîte à hauteur fixe, image en « contain »).
    const logo = company.logoUrl
      ? branded
        ? `<div style="padding:6px 8px;border-radius:12px;background:#fff;border:1px solid ${theme.softBorder}">${logoBox(company.logoUrl, { width: 160, height: 56 })}</div>`
        : logoBox(company.logoUrl, { width: 150, height: 52 })
      : monogram(company.name, theme);

    const slogan = company.slogan
      ? branded
        ? `<div style="display:inline-block;font-size:9.5px;font-weight:600;color:${theme.ink};background:${theme.soft};border-radius:999px;padding:2px 9px;margin-top:3px">${esc(company.slogan)}</div>`
        : `<div style="font-size:10px;font-style:italic;color:${theme.ink};margin-top:1px">${esc(company.slogan)}</div>`
      : "";

    const rows = sortedLines(doc)
      .map((line, i) => {
        const border = i === 0 ? "none" : "1px solid #F1F5F9";
        return `
      <tr>
        <td style="padding:10px 12px;font-size:12px;font-weight:500;color:#0F172A;border-top:${border}">${esc(line.name)}</td>
        <td style="padding:10px 12px;font-size:12px;color:#475569;text-align:center;border-top:${border};white-space:nowrap">${line.quantity} ${esc(line.unit)}</td>
        <td style="padding:10px 12px;font-size:12px;color:#475569;text-align:right;border-top:${border};white-space:nowrap">${fcfa(line.unitPrice)}</td>
        <td style="padding:10px 12px;font-size:12px;font-weight:700;color:#0F172A;text-align:right;border-top:${border};white-space:nowrap">${fcfa(line.lineTotal)}</td>
      </tr>`;
      })
      .join("");

    const th = (label: string, align: string) =>
      `<th style="padding:10px 12px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;text-align:${align}">${label}</th>`;

    const advance = totals.advance
      ? totalRowHtml(totals.advance) +
        `<div style="display:flex;justify-content:space-between;font-size:13px;font-weight:800;color:${theme.ink};padding:6px 12px;background:${theme.soft};border-radius:8px;margin-top:4px"><span>${totals.remaining!.label}</span><span style="font-variant-numeric:tabular-nums">${totals.remaining!.value}</span></div>`
      : "";

    const body = `
  ${watermark(company, branded)}
  <div class="content">

  <div style="height:5px;border-radius:999px;background:linear-gradient(90deg,${theme.brand},${theme.softBorder});margin-bottom:16px"></div>

  <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;padding-bottom:16px;border-bottom:1px solid #E2E8F0;margin-bottom:18px">
    <div style="display:flex;gap:14px;align-items:center;min-width:0">
      ${logo}
      <div style="min-width:0">
        <div style="font-size:${branded ? "18px" : "16px"};font-weight:800;color:#0F172A;letter-spacing:-.01em">${esc(company.name)}</div>
        ${slogan}
        <div style="font-size:10px;color:#64748B;line-height:1.55;margin-top:3px">${contactLines(company).join("<br/>")}</div>
      </div>
    </div>
    <div style="text-align:right;flex-shrink:0">
      <div style="font-size:23px;font-weight:800;color:${theme.ink};letter-spacing:.03em">${titleWord(doc, s)}</div>
      <div style="display:inline-block;font-size:10.5px;font-weight:700;color:${theme.ink};background:${theme.soft};border:1px solid ${theme.softBorder};border-radius:999px;padding:2px 10px;margin-top:4px">N° ${esc(doc.number)}</div>
      <div style="font-size:8.5px;color:#94A3B8;text-transform:uppercase;letter-spacing:.08em;margin-top:9px">${s.date}</div>
      <div style="font-size:12px;font-weight:600;color:#0F172A">${frDate(doc.issueDate)}</div>
    </div>
  </div>

  ${doc.title ? `<div style="font-size:13px;font-weight:700;color:#0F172A;margin-bottom:12px">${esc(doc.title)}</div>` : ""}

  <div style="background:${theme.soft};border-left:3px solid ${theme.brand};border-radius:8px;padding:10px 14px;margin-bottom:16px">
    <div style="font-size:8.5px;font-weight:700;color:${theme.ink};text-transform:uppercase;letter-spacing:.08em">${s.client}</div>
    <div style="font-size:13px;font-weight:700;color:#0F172A;margin-top:1px">${esc(doc.clientName || "—")}</div>
    ${doc.clientPhone ? `<div style="font-size:11px;color:#64748B">${esc(doc.clientPhone)}</div>` : ""}
  </div>

  ${descriptionBlock(doc, theme, s)}

  <div style="border:1px solid #E2E8F0;border-radius:10px;overflow:hidden">
    <table style="width:100%;border-collapse:collapse">
      <thead>
        <tr style="background:${theme.brand};color:${theme.onBrand}">
          ${th(s.designation, "left")}${th(s.qty, "center")}${th(s.unitPrice, "right")}${th(s.total, "right")}
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  </div>

  <div style="display:flex;justify-content:flex-end;margin-top:16px">
    <div style="width:260px;background:#F8FAFC;border:1px solid #EEF2F7;border-radius:12px;padding:12px 14px">
      ${totals.rows.map((row) => totalRowHtml(row)).join("")}
      <div style="display:flex;justify-content:space-between;align-items:center;font-size:14px;font-weight:800;background:linear-gradient(135deg,${theme.brand},${theme.brandAlt});color:${theme.onBrand};padding:10px 14px;border-radius:9px;margin-top:6px"><span>${totals.totalLabel}</span><span style="font-variant-numeric:tabular-nums">${totals.total}</span></div>
      ${advance}
    </div>
  </div>

  ${amountStatement(doc, s)}
  ${conditionsAndNote(doc, theme, s)}

  ${documentEnd(doc, company, theme, s, totals.vatNa, branded)}
  </div>`;

    return pageShell(doc.number, body);
  },
};
