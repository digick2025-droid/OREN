"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/features/i18n/language-context";
import { STATUS_STYLES } from "@/lib/constants";
import { formatAmount, formatDate } from "@/lib/format";
import { statusLabel, typeLabel } from "@/lib/i18n/labels";
import type { DocumentRow } from "@/types/database";

export function DocumentCard({ document }: { document: DocumentRow }) {
  const { t } = useI18n();
  const status = STATUS_STYLES[document.status];

  return (
    <Link
      href={`/documents/${document.id}`}
      className="block rounded-2xl border border-[#E9EBF0] bg-white p-4 transition-colors hover:border-[#C3C9D5]"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[12px] font-semibold text-[#8A93A6]">
          {document.number} · {typeLabel(t, document.type)}
        </span>
        <Badge bg={status.bg} color={status.color}>
          {statusLabel(t, document.status)}
        </Badge>
      </div>
      <div className="mt-1.5 truncate text-[15px] font-bold text-navy">
        {document.title || document.client_name || t.untitled}
      </div>
      <div className="mt-1 flex items-center justify-between text-[13px]">
        <span className="text-[#5A6377]">
          {document.client_name || "—"} · {formatDate(document.created_at)}
        </span>
        <span className="font-extrabold text-navy">
          {formatAmount(document.total)}
        </span>
      </div>
    </Link>
  );
}
