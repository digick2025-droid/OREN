"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ScreenHeader } from "@/components/screen-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/features/i18n/language-context";
import { useDeleteClient, useSaveClient } from "@/hooks/use-clients";
import type { Client } from "@/types/database";

export function ClientForm({ client }: { client: Client | null }) {
  const router = useRouter();
  const { t } = useI18n();
  const saveClient = useSaveClient();
  const deleteClient = useDeleteClient();
  const [name, setName] = useState(client?.name ?? "");
  const [phone, setPhone] = useState(client?.phone ?? "");
  const [address, setAddress] = useState(client?.address ?? "");

  const save = () => {
    if (!name.trim()) {
      toast.error(t.toast_need_name);
      return;
    }
    saveClient.mutate(
      {
        id: client?.id,
        values: {
          name: name.trim(),
          phone: phone.trim() || null,
          address: address.trim() || null,
        },
      },
      {
        onSuccess: () => {
          toast.success(t.toast_client_saved);
          router.push("/clients");
        },
        onError: () => toast.error(t.toast_save_error),
      },
    );
  };

  const remove = () => {
    if (!client) return;
    deleteClient.mutate(client.id, {
      onSuccess: () => {
        toast.success(t.toast_deleted);
        router.push("/clients");
      },
      onError: () => toast.error(t.toast_delete_error),
    });
  };

  return (
    <div>
      <ScreenHeader
        title={client ? t.client_edit : t.client_new}
        backHref="/clients"
      />
      <div className="space-y-5 px-4 pt-5">
        <div>
          <Label htmlFor="client-name">{t.f_name}</Label>
          <Input
            id="client-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Jean Kouassi"
          />
        </div>
        <div>
          <Label htmlFor="client-phone">{t.f_phone}</Label>
          <Input
            id="client-phone"
            inputMode="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="6 90 00 00 00"
          />
        </div>
        <div>
          <Label htmlFor="client-address">{t.f_addr}</Label>
          <Input
            id="client-address"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Akwa, Douala"
          />
        </div>

        <Button
          className="w-full"
          onClick={save}
          disabled={saveClient.isPending}
        >
          {saveClient.isPending ? t.saving : t.save}
        </Button>

        {client && (
          <Button
            variant="destructive"
            className="w-full"
            onClick={remove}
            disabled={deleteClient.isPending}
          >
            {t.delete}
          </Button>
        )}
      </div>
    </div>
  );
}
