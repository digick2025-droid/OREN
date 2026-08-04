"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ImagePlus, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  useCreateTestimonial,
  useDeleteTestimonial,
  useUpdateTestimonial,
  type Testimonial,
} from "@/hooks/use-admin-testimonials";
import { createClient } from "@/lib/supabase/client";
import { prepareTestimonialImage, TESTIMONIAL_IMAGE_ACCEPT_ATTR } from "@/lib/upload";

export function TestimonialForm({ testimonial }: { testimonial?: Testimonial }) {
  const router = useRouter();
  const supabase = createClient();
  const create = useCreateTestimonial();
  const update = useUpdateTestimonial();
  const remove = useDeleteTestimonial();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [authorName, setAuthorName] = useState(testimonial?.author_name ?? "");
  const [authorRole, setAuthorRole] = useState(testimonial?.author_role ?? "");
  const [quote, setQuote] = useState(testimonial?.quote ?? "");
  const [imageUrl, setImageUrl] = useState<string | null>(
    testimonial?.image_url ?? null,
  );
  const [uploading, setUploading] = useState(false);
  const [displayOrder, setDisplayOrder] = useState(
    String(testimonial?.display_order ?? 0),
  );
  const [isActive, setIsActive] = useState(testimonial?.is_active ?? true);

  const isSaving = create.isPending || update.isPending;

  const uploadImage = async (file: File) => {
    const prepared = await prepareTestimonialImage(file);
    if (!prepared.ok) {
      toast.error(prepared.message);
      return;
    }
    const safeFile = prepared.file;
    setUploading(true);
    const ext = safeFile.name.split(".").pop() ?? "webp";
    const path = `${crypto.randomUUID()}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from("testimonial-images")
      .upload(path, safeFile, { contentType: safeFile.type });
    setUploading(false);
    if (uploadError) {
      console.error("[testimonial] upload storage:", uploadError);
      toast.error("Échec de l'envoi de l'image.");
      return;
    }
    const { data } = supabase.storage.from("testimonial-images").getPublicUrl(path);
    setImageUrl(data.publicUrl);
  };

  const handleSave = () => {
    if (!authorName.trim()) {
      toast.error("Entrez le nom de la personne.");
      return;
    }
    if (!quote.trim() && !imageUrl) {
      toast.error("Ajoutez une citation ou une capture d'écran.");
      return;
    }
    const values = {
      author_name: authorName.trim(),
      author_role: authorRole.trim() || null,
      quote: quote.trim() || null,
      image_url: imageUrl,
      display_order: Number.parseInt(displayOrder, 10) || 0,
      is_active: isActive,
    };

    if (testimonial) {
      update.mutate(
        { id: testimonial.id, values },
        {
          onSuccess: () => {
            toast.success("Témoignage mis à jour.");
            router.push("/admin/temoignages");
          },
          onError: (err) => toast.error(err.message),
        },
      );
    } else {
      create.mutate(values, {
        onSuccess: () => {
          toast.success("Témoignage ajouté.");
          router.push("/admin/temoignages");
        },
        onError: (err) => toast.error(err.message),
      });
    }
  };

  const handleDelete = () => {
    if (!testimonial) return;
    if (!window.confirm("Supprimer ce témoignage ?")) return;
    remove.mutate(testimonial.id, {
      onSuccess: () => {
        toast.success("Témoignage supprimé.");
        router.push("/admin/temoignages");
      },
      onError: (err) => toast.error(err.message),
    });
  };

  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">
            Témoignage
          </h2>
          <div className="flex items-center gap-2">
            <Switch checked={isActive} onCheckedChange={setIsActive} />
            <span className="text-[13.5px] font-semibold text-navy">
              {isActive ? "Visible" : "Masqué"}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="testimonial-name">Nom</Label>
            <Input
              id="testimonial-name"
              value={authorName}
              onChange={(e) => setAuthorName(e.target.value)}
              placeholder="Awa Ndiaye"
            />
          </div>
          <div>
            <Label htmlFor="testimonial-role">Métier (optionnel)</Label>
            <Input
              id="testimonial-role"
              value={authorRole}
              onChange={(e) => setAuthorRole(e.target.value)}
              placeholder="Plombière, Douala"
            />
          </div>
        </div>

        <div>
          <Label>Capture d&rsquo;écran (optionnel)</Label>
          <input
            ref={fileInputRef}
            type="file"
            accept={TESTIMONIAL_IMAGE_ACCEPT_ATTR}
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void uploadImage(file);
              e.target.value = "";
            }}
          />
          {imageUrl ? (
            <div className="relative mt-1.5 inline-block">
              {/* eslint-disable-next-line @next/next/no-img-element -- capture d'écran externe (bucket public), pas d'optimisation Next nécessaire */}
              <img
                src={imageUrl}
                alt=""
                className="max-h-64 rounded-xl border border-border object-contain"
              />
              <button
                type="button"
                aria-label="Retirer l'image"
                onClick={() => setImageUrl(null)}
                className="absolute -right-2 -top-2 grid h-7 w-7 place-items-center rounded-full bg-navy text-white shadow-sm"
              >
                <X size={14} />
              </button>
            </div>
          ) : (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="mt-1.5"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? (
                <>
                  <Loader2 size={15} className="animate-spin" /> Envoi…
                </>
              ) : (
                <>
                  <ImagePlus size={15} /> Ajouter une image
                </>
              )}
            </Button>
          )}
        </div>

        <div>
          <Label htmlFor="testimonial-quote">Citation (optionnel si image)</Label>
          <Textarea
            id="testimonial-quote"
            value={quote}
            onChange={(e) => setQuote(e.target.value)}
            placeholder="Je crée mes devis en 2 minutes, directement sur WhatsApp."
          />
        </div>

        <div>
          <Label htmlFor="testimonial-order">Ordre d&rsquo;affichage</Label>
          <Input
            id="testimonial-order"
            inputMode="numeric"
            value={displayOrder}
            onChange={(e) => setDisplayOrder(e.target.value.replace(/[^\d]/g, ""))}
            placeholder="0"
          />
        </div>

        <div className="flex gap-3">
          <Button className="flex-1" onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Enregistrement…" : "Enregistrer"}
          </Button>
          {testimonial ? (
            <Button
              variant="outline"
              onClick={handleDelete}
              disabled={remove.isPending}
            >
              Supprimer
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
