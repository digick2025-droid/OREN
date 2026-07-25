import { Check, CheckCheck } from "lucide-react";
import { formatAmountShort } from "@/lib/format";
import type { Lang } from "@/lib/i18n/config";
import type { Dict } from "@/lib/i18n/dictionaries";

/* =============================================================
   OREN · Signature de la landing — le devis tel que le client le
   reçoit, dans une conversation WhatsApp.

   Cette maquette imite WhatsApp : ses couleurs (`whatsapp-*`) et le
   papier du devis (`bg-white` + `brand-navy`) sont volontairement
   FIXES — elles ne suivent pas le thème clair/sombre d'OREN, sinon
   l'illusion tombe.
   ============================================================= */

const DEMO_AMOUNTS = [85_000, 42_000, 30_000] as const;

export function WhatsAppShowcase({ t, lang }: { t: Dict; lang: Lang }) {
  const lines = [
    { label: t.land_demo_line1, amount: DEMO_AMOUNTS[0] },
    { label: t.land_demo_line2, amount: DEMO_AMOUNTS[1] },
    { label: t.land_demo_line3, amount: DEMO_AMOUNTS[2] },
  ];
  const total = lines.reduce((sum, line) => sum + line.amount, 0);
  const date = new Intl.DateTimeFormat(lang === "en" ? "en-GB" : "fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date());

  return (
    <div className="mx-auto max-w-[21.25rem] rounded-dialog border border-white/10 bg-brand-navy p-2.5 shadow-xl">
      <div className="overflow-hidden rounded-card bg-whatsapp-chat">
        {/* En-tête de la conversation */}
        <div className="flex items-center gap-2.5 bg-whatsapp-header px-3.5 py-3 text-white">
          <span className="grid h-[34px] w-[34px] place-items-center rounded-full bg-accent text-[13px] font-extrabold">
            {t.land_demo_company_initials}
          </span>
          <span className="leading-tight">
            <span className="block text-[13.5px] font-bold">
              {t.land_demo_contact}
            </span>
            <span className="block text-[11px] text-white/70">
              {t.land_demo_status}
            </span>
          </span>
        </div>

        <div className="px-3 pb-3.5 pt-4">
          {/* Message d'accompagnement */}
          <div className="mb-2.5 max-w-[82%] rounded-xl rounded-bl-sm bg-whatsapp-bubble px-2.5 py-1.5 text-[12.5px] text-brand-navy shadow-xs">
            {t.land_demo_message}
            <span className="mt-0.5 flex items-center justify-end gap-1 text-[9.5px] text-brand-navy/50">
              {t.land_demo_time}
              <CheckCheck className="h-3 w-3" />
            </span>
          </div>

          {/* Le devis */}
          <div className="overflow-hidden rounded-md bg-white text-brand-navy shadow-md">
            <div className="flex items-start justify-between gap-3 border-b-2 border-accent px-3 py-2.5">
              <span className="flex items-center gap-1.5">
                <span className="grid h-[22px] w-[22px] shrink-0 place-items-center rounded-sm bg-brand-navy text-[11px] font-black text-white">
                  {t.land_demo_company_initials}
                </span>
                <span className="leading-tight">
                  <span className="block text-[11px] font-extrabold tracking-tight">
                    {t.land_demo_company}
                  </span>
                  <span className="block text-[7.5px] text-brand-navy/50">
                    {t.land_demo_company_tagline}
                  </span>
                </span>
              </span>
              <span className="text-right leading-tight">
                <span className="block text-[11px] font-extrabold tracking-widest text-coral">
                  {t.land_demo_doc_label}
                </span>
                <span className="block text-[8px] text-brand-navy/50">
                  {t.land_demo_doc_number}
                </span>
              </span>
            </div>

            <div className="flex justify-between bg-brand-navy/5 px-3 py-2">
              <span>
                <span className="block text-[7px] uppercase tracking-wider text-brand-navy/50">
                  {t.land_demo_client_label}
                </span>
                <b className="text-[9px]">{t.land_demo_contact}</b>
              </span>
              <span className="text-right">
                <span className="block text-[7px] uppercase tracking-wider text-brand-navy/50">
                  {t.land_demo_date_label}
                </span>
                <b className="text-[9px]">{date}</b>
              </span>
            </div>

            <div className="px-3 pt-1">
              <div className="flex justify-between border-b border-brand-navy/10 py-1.5 text-[7px] uppercase tracking-wider text-brand-navy/50">
                <span>{t.land_demo_col_desc}</span>
                <span>{t.land_demo_col_amount}</span>
              </div>
              {lines.map((line) => (
                <div
                  key={line.label}
                  className="flex justify-between gap-3 border-b border-brand-navy/10 py-1.5 text-[10px]"
                >
                  <span>{line.label}</span>
                  <span className="font-semibold tabular-nums">
                    {formatAmountShort(line.amount)}
                  </span>
                </div>
              ))}
            </div>

            <div className="mx-3 mt-2 flex items-center justify-between rounded-sm bg-brand-navy px-2.5 py-2 text-white">
              <span className="text-[9px] opacity-80">{t.land_demo_total}</span>
              <span className="text-[13px] font-extrabold tabular-nums">
                {formatAmountShort(total)} {t.land_price_currency}
              </span>
            </div>

            <p className="px-3 pb-2.5 pt-2 text-center text-[7px] text-brand-navy/50">
              {t.land_demo_terms}
            </p>
          </div>

          <span className="mt-1 flex items-center justify-end gap-1 text-[9px] text-brand-navy/50">
            {t.land_demo_time}
            <Check className="h-3 w-3" />
          </span>
        </div>
      </div>
    </div>
  );
}
