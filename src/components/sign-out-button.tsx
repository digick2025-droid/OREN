"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { clearOfflineData } from "@/lib/offline";
import { desactiverPush } from "@/lib/push";
import { createClient } from "@/lib/supabase/client";

export function SignOutButton() {
  const router = useRouter();
  const supabase = createClient();

  const signOut = async () => {
    // Avant signOut : le désabonnement push a besoin de la session (RLS).
    await desactiverPush();
    await supabase.auth.signOut();
    await clearOfflineData();
    router.push("/");
    router.refresh();
  };

  return (
    <Button variant="outline" className="w-full" onClick={() => void signOut()}>
      <LogOut size={17} /> Déconnexion
    </Button>
  );
}
