"use client";

import { useRef, useState } from "react";
import { useParams } from "next/navigation";
import { Camera, Check, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { ScreenHeader } from "@/components/screen-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  SignaturePad,
  type SignaturePadHandle,
} from "@/components/signature-pad";
import { useClients } from "@/hooks/use-clients";
import { useIntervention } from "@/hooks/use-interventions";
import {
  useAddReportPhoto,
  useInterventionReport,
  useRemoveReportPhoto,
  useReportMediaUrls,
  useSaveReport,
  useSaveSignature,
} from "@/hooks/use-intervention-reports";
import { TESTIMONIAL_IMAGE_ACCEPT_ATTR } from "@/lib/upload";
import type {
  InterventionPhoto,
  InterventionPhotoKind,
} from "@/types/database";

export default function InterventionReportPage() {
  const params = useParams<{ id: string }>();
  const interventionId = params.id;

  const { data: intervention, isLoading } = useIntervention(interventionId);
  const { data: report } = useInterventionReport(interventionId);
  const { data: clients } = useClients();
  const { data: mediaUrls } = useReportMediaUrls(report);

  const saveReport = useSaveReport(interventionId);
  const addPhoto = useAddReportPhoto(interventionId);
  const removePhoto = useRemoveReportPhoto(interventionId);
  const saveSignature = useSaveSignature(interventionId);

  const padRef = useRef<SignaturePadHandle>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [signedBy, setSignedBy] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div>
        <ScreenHeader title="Rapport" backHref={`/interventions/${interventionId}`} />
        <p className="px-4 pt-6 text-[13px] text-muted-foreground">Chargement…</p>
      </div>
    );
  }

  if (!intervention) {
    return (
      <div>
        <ScreenHeader title="Rapport" backHref="/interventions" />
        <p className="px-4 pt-6 text-[13px] text-muted-foreground">
          Intervention introuvable.
        </p>
      </div>
    );
  }

  const photos = report?.photos ?? [];
  const before = photos.filter((p) => p.kind === "before");
  const after = photos.filter((p) => p.kind === "after");
  const client = clients?.find((c) => c.id === intervention.client_id)?.name;

  // Valeurs contrôlées : état local s'il a été touché, sinon valeur en base.
  const summaryValue = summary ?? report?.summary ?? "";
  const signedByValue = signedBy ?? report?.signed_by ?? "";

  const onPick = (kind: InterventionPhotoKind) => (file: File | null) => {
    if (!file) return;
    addPhoto.mutate(
      { file, kind, current: photos },
      {
        onSuccess: () => toast.success("Photo ajoutée"),
        onError: (e) => toast.error(e.message),
      },
    );
  };

  const onRemove = (photo: InterventionPhoto) => {
    removePhoto.mutate(
      { photo, current: photos },
      { onError: (e) => toast.error(e.message) },
    );
  };

  const onSaveText = () => {
    saveReport.mutate(
      { summary: summaryValue },
      {
        onSuccess: () => toast.success("Compte-rendu enregistré"),
        onError: (e) => toast.error(e.message),
      },
    );
  };

  const onSign = async () => {
    const pad = padRef.current;
    if (!pad || pad.isEmpty()) {
      toast.error("Faites signer le client dans le cadre");
      return;
    }
    if (!signedByValue.trim()) {
      toast.error("Indiquez le nom du signataire");
      return;
    }
    const blob = await pad.toBlob();
    if (!blob) {
      toast.error("Signature illisible, réessayez");
      return;
    }
    saveSignature.mutate(
      { blob, signedBy: signedByValue.trim() },
      {
        onSuccess: () => {
          toast.success("Rapport signé");
          pad.clear();
        },
        onError: (e) => toast.error(e.message),
      },
    );
  };

  const signedAt = report?.signed_at
    ? new Date(report.signed_at).toLocaleString("fr-FR", {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : null;

  return (
    <div className="pb-10">
      <ScreenHeader
        title="Rapport d'intervention"
        backHref={`/interventions/${interventionId}`}
      />
      <div className="space-y-6 px-4 pt-4">
        <div>
          <h1 className="text-[17px] font-extrabold text-navy">
            {intervention.title}
          </h1>
          {client ? (
            <p className="text-[13px] text-muted-foreground">{client}</p>
          ) : null}
        </div>

        {/* Travaux réalisés */}
        <div>
          <Label htmlFor="rp-summary">Travaux réalisés</Label>
          <textarea
            id="rp-summary"
            value={summaryValue}
            onChange={(e) => setSummary(e.target.value)}
            rows={4}
            className="w-full rounded-[14px] border-[1.5px] border-border bg-card px-3 py-2.5 text-[15px] text-navy focus-visible:border-navy focus-visible:outline-none"
            placeholder="Diagnostic, pièces posées, état final…"
          />
          <Button
            variant="outline"
            className="mt-2 w-full"
            onClick={onSaveText}
            disabled={saveReport.isPending}
          >
            {saveReport.isPending ? "Enregistrement…" : "Enregistrer le compte-rendu"}
          </Button>
        </div>

        <PhotoSection
          title="Photos avant"
          kind="before"
          photos={before}
          urls={mediaUrls}
          onPick={onPick("before")}
          onRemove={onRemove}
          uploading={addPhoto.isPending}
        />

        <PhotoSection
          title="Photos après"
          kind="after"
          photos={after}
          urls={mediaUrls}
          onPick={onPick("after")}
          onRemove={onRemove}
          uploading={addPhoto.isPending}
        />

        {/* Signature */}
        <div className="space-y-3">
          <Label>Signature du client</Label>

          {report?.signature_path && signedAt ? (
            <Card className="space-y-2 px-4 py-3.5">
              <div className="flex items-center gap-1.5 text-[13px] font-semibold text-emerald-700">
                <Check size={15} /> Signé par {report.signed_by || "le client"}
              </div>
              <p className="text-[12px] text-muted-foreground">Le {signedAt}</p>
              {mediaUrls?.[report.signature_path] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={mediaUrls[report.signature_path]}
                  alt="Signature"
                  className="h-24 w-auto rounded-[10px] border border-border bg-white"
                />
              ) : null}
              <p className="text-[12px] text-muted-foreground">
                Pour refaire signer, saisissez le nom et signez à nouveau
                ci-dessous.
              </p>
            </Card>
          ) : null}

          <div>
            <Label htmlFor="rp-signer">Nom du signataire</Label>
            <Input
              id="rp-signer"
              value={signedByValue}
              onChange={(e) => setSignedBy(e.target.value)}
              placeholder="Nom du client présent"
            />
          </div>

          <SignaturePad ref={padRef} />
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => padRef.current?.clear()}
              type="button"
            >
              Effacer
            </Button>
            <Button
              className="flex-1"
              onClick={onSign}
              disabled={saveSignature.isPending}
            >
              {saveSignature.isPending ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Check size={16} />
              )}{" "}
              {report?.signature_path ? "Refaire signer" : "Valider la signature"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function PhotoSection({
  title,
  kind,
  photos,
  urls,
  onPick,
  onRemove,
  uploading,
}: {
  title: string;
  kind: InterventionPhotoKind;
  photos: InterventionPhoto[];
  urls: Record<string, string> | undefined;
  onPick: (file: File | null) => void;
  onRemove: (photo: InterventionPhoto) => void;
  uploading: boolean;
}) {
  const inputId = `rp-photo-${kind}`;
  return (
    <div>
      <Label>{title}</Label>
      <div className="grid grid-cols-3 gap-2">
        {photos.map((p) => (
          <div
            key={p.path}
            className="relative aspect-square overflow-hidden rounded-[12px] border border-border bg-muted"
          >
            {urls?.[p.path] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={urls[p.path]}
                alt={title}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <Loader2 size={16} className="animate-spin text-muted-foreground" />
              </div>
            )}
            <button
              type="button"
              aria-label="Retirer la photo"
              onClick={() => onRemove(p)}
              className="absolute right-1 top-1 rounded-full bg-navy/70 p-1 text-white"
            >
              <X size={13} />
            </button>
          </div>
        ))}

        <label
          htmlFor={inputId}
          className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-[12px] border-[1.5px] border-dashed border-border bg-card text-muted-foreground"
        >
          {uploading ? (
            <Loader2 size={18} className="animate-spin" />
          ) : (
            <Camera size={18} />
          )}
          <span className="text-[11px] font-semibold">Ajouter</span>
          <input
            id={inputId}
            type="file"
            accept={TESTIMONIAL_IMAGE_ACCEPT_ATTR}
            capture="environment"
            className="hidden"
            onChange={(e) => {
              onPick(e.target.files?.[0] ?? null);
              e.target.value = "";
            }}
          />
        </label>
      </div>
    </div>
  );
}
