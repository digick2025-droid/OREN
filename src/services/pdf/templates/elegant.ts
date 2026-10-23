/**
 * Modèle « elegant » — sobre et aéré : logo centré, titre en capitales
 * espacées entre deux filets à la couleur de l'entreprise, tableau sans
 * cadre à séparateurs fins, total souligné d'un trait de couleur.
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
  monogram,
  pageShell,
  sortedLines,
  titleWord,
  totalRowHtml,
  watermark,
} from "../theme";

export const elegantTemplate: PdfTemplate = {
  id: "elegant",

  render(doc: PdfDocumentData, company: PdfCompany, s: PdfStrings): string {
    const theme = buildTheme(company.color);
    const branded = company.premiumBranding && !!company.logoUrl;
    const totals = buildTotals(doc, s);

    const logo = company.logoUrl
      ? logoBox(company.logoUrl, { width: 190, height: 60, align: "center" })
      : monogram(company.name, theme, 48);

    const rule = `<div style="flex:1;height:1px;background:${theme.brand}"></div>`;

    const rows = sortedLines(doc)
      .map(
        (line) => `
      <tr>
        <td style="padding:10px 4px;font-size:12px;color:#0F172A;border-bottom:1px solid #EEF2F7">${esc(line.name)}</td>
        <td style="padding:10px 4px;font-size:12px;color:#64748B;text-align:center;border-bottom:1px solid #EEF2F7;white-space:nowrap">${line.quantity} ${esc(line.unit)}</td>
        <td style="padding:10px 4px;font-size:12px;color:#64748B;text-align:right;border-bottom:1px solid #EEF2F7;white-space:nowrap">${fcfa(line.unitPrice)}</td>
        <td style="padding:10px 4px;font-size:12px;font-weight:600;color:#0F172A;text-align:right;border-bottom:1px solid #EEF2F7;white-space:nowrap">${fcfa(line.lineTotal)}</td>
      </tr>`,
      )
      .join("");

    const th = (label: string, align: string) =>
      `<th style="padding:8px 4px;font-size:9px;font-weight:700;color:${theme.ink};text-transform:uppercase;letter-spacing:.14em;text-align:${align};border-bottom:1px solid ${theme.brand};background:#fff">${label}</th>`;

    const advance = totals.advance
      ? totalRowHtml(totals.advance) +
        `<div style="display:flex;justify-content:space-between;font-size:12.5px;font-weight:700;color:${theme.ink};padding:5px 0"><span>${totals.remaining!.label}</span><span style="font-variant-numeric:tabular-nums">${totals.remaining!.value}</span></div>`
      : "";

    const body = `
  ${watermark(company, branded)}
  <div class="content">

  <div style="display:flex;flex-direction:column;align-items:center;text-align:center;margin-bottom:16px">
    ${logo}
    <div style="font-size:15px;font-weight:700;color:#0F172A;letter-spacing:.12em;text-transform:uppercase;margin-top:10px">${esc(company.name)}</div>
    ${company.slogan ? `<div style="font-size:10px;font-style:italic;color:${theme.ink};margin-top:2px">${esc(company.slogan)}</div>` : ""}
    <div style="font-size:9.5px;color:#64748B;margin-top:5px">${contactLines(company).join(" · ")}</div>
  </div>

  <div style="display:flex;align-items:center;gap:14px;margin-bottom:6px">
    ${rule}
    <div style="font-size:19px;font-weight:600;color:${theme.ink};letter-spacing:.32em;padding-left:.32em">${titleWord(doc, s)}</div>
    ${rule}
  </div>
  <div style="text-align:center;font-size:10.5px;color:#64748B;margin-bottom:20px">N° ${esc(doc.number)} · ${frDate(doc.issueDate)}</div>

  <div style="display:flex;justify-content:space-between;gap:20px;margin-bottom:16px">
    <div>
      ${eyebrow(s.client, theme.ink)}
      <div style="font-size:13px;font-weight:600;color:#0F172A;margin-top:3px">${esc(doc.clientName || "—")}</div>
      ${doc.clientPhone ? `<div style="font-size:11px;color:#64748B">${esc(doc.clientPhone)}</div>` : ""}
    </div>
    ${doc.title ? `<div style="text-align:right;max-width:55%"><div style="font-size:13px;font-weight:600;color:#0F172A">${esc(doc.title)}</div></div>` : ""}
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
    <div style="width:250px">
      ${totals.rows.map((row) => totalRowHtml(row)).join("")}
      <div style="display:flex;justify-content:space-between;align-items:baseline;font-size:15px;font-weight:700;color:${theme.ink};border-top:2px solid ${theme.brand};padding-top:8px;margin-top:6px"><span>${totals.totalLabel}</span><span style="font-variant-numeric:tabular-nums">${totals.total}</span></div>
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
