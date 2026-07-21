"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  useAdminAnnouncement,
  useSaveAnnouncement,
} from "@/hooks/use-admin-announcement";
import { cn } from "@/lib/utils";

function toDateInputValue(iso: string | null): string {
  if (!iso) return "";
  return iso.slice(0, 10);
}

export function AnnouncementForm() {
  const { data: announcement } = useAdminAnnouncement();
  const save = useSaveAnnouncement();

  const [message, setMessage] = useState("");
  const [level, setLevel] = useState<"info" | "warning">("info");
  const [isActive, setIsActive] = useState(false);
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");

  useEffect(() => {
    if (!announcement) return;
    setMessage(announcement.message);
    setLevel(announcement.level);
    setIsActive(announcement.is_active);
    setStartsAt(toDateInputValue(announcement.starts_at));
    setEndsAt(toDateInputValue(announcement.ends_at));
  }, [announcement]);

  const handleSave = () => {
    if (!message.trim()) {
      toast.error("Entrez un message.");
      return;
    }
    save.mutate(
      {
        id: announcement?.id ?? null,
        message: message.trim(),
        level,
        is_active: isActive,
        starts_at: startsAt ? new Date(startsAt).toISOString() : null,
        ends_at: endsAt ? new Date(endsAt).toISOString() : null,
      },
      {
        onSuccess: () => toast.success("Bannière enregistrée."),
        onError: (err) => toast.error(err.message),
      },
    );
  };

  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">
            Bannière d&rsquo;annonce
          </h2>
          <div className="flex items-center gap-2">
            <Switch checked={isActive} onCheckedChange={setIsActive} />
            <span className="text-[13.5px] font-semibold text-navy">Active</span>
          </div>
        </div>

        <div>
          <Label htmlFor="announcement-message">Message</Label>
          <Textarea
            id="announcement-message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Maintenance prévue le 25/07 de 22h à 23h."
          />
        </div>

        <div>
          <Label>Niveau</Label>
          <div className="flex gap-2">
            {(["info", "warning"] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setLevel(v)}
                className={cn(
                  "flex-1 rounded-field border-[1.5px] px-3 py-2.5 text-[13px] font-semibold transition-colors",
                  level === v
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-muted-foreground",
                )}
              >
                {v === "info" ? "Information" : "Avertissement"}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="announcement-start">Début (optionnel)</Label>
            <Input
              id="announcement-start"
              type="date"
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="announcement-end">Fin (optionnel)</Label>
            <Input
              id="announcement-end"
              type="date"
              value={endsAt}
              onChange={(e) => setEndsAt(e.target.value)}
            />
          </div>
        </div>

        <Button className="w-full" onClick={handleSave} disabled={save.isPending}>
          {save.isPending ? "Enregistrement…" : "Enregistrer"}
        </Button>
      </CardContent>
    </Card>
  );
}
