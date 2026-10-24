"use client";

import { CloudOff, RotateCw, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/features/i18n/language-context";
import { formatAmount, formatDate } from "@/lib/format";
import { typeLabel } from "@/lib/i18n/labels";
import {
  removeOutboxEntry,
  retryOutboxEntry,
  type OutboxEntry,
} from "@/lib/outbox";

/**
 * Document créé hors connexion, pas encore dans la base : pas de numéro ni
 * de fiche à ouvrir, d'où une carte à part plutôt qu'un faux `DocumentCard`.
 */
export function PendingDocumentCard({ entry }: { entry: OutboxEntry }) {
  const { t } = useI18n();
  const { payload } = entry;
  const name = payload.client_name || entry.newClient?.name || "";
  const quota = entry.error?.includes("QUOTA_EXCEEDED");

  const remove = () => {
    if (window.confirm(t.outbox_delete_confirm)) removeOutboxEntry(entry.localId);
  };

  return (
    <div className="rounded-2xl border border-dashed border-border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-[12px] font-semibold text-muted-foreground/70">
          <CloudOff size={13} /> {typeLabel(t, payload.type)}
        </span>
        <Badge variant={entry.error ? "error" : "warning"}>
          {entry.error ? t.outbox_error : t.outbox_pending}
        </Badge>
      </div>
      <div className="mt-1.5 truncate text-[15px] font-bold text-navy">
        {payload.title || name || t.untitled}
      </div>
      <div className="mt-1 flex items-center justify-between text-[13px]">
        <span className="text-muted-foreground">
          {name || "—"} · {formatDate(entry.createdAt)}
        </span>
        <span className="font-extrabold text-navy">{formatAmount(entry.total)}</span>
      </div>
      <p className="mt-2 text-[12px] text-muted-foreground">
        {entry.error ? (quota ? t.outbox_error_quota : entry.error) : t.outbox_hint}
      </p>
      <div className="mt-2 flex justify-end gap-4">
        {entry.error && (
          <button
            type="button"
            onClick={() => retryOutboxEntry(entry.localId)}
            className="flex items-center gap-1 text-[13px] font-semibold text-coral"
          >
            <RotateCw size={14} /> {t.outbox_retry}
          </button>
        )}
        <button
          type="button"
          onClick={remove}
          className="flex items-center gap-1 text-[13px] font-semibold text-muted-foreground hover:text-danger"
        >
          <Trash2 size={14} /> {t.delete}
        </button>
      </div>
    </div>
  );
}
