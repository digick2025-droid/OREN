import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Oublie un appareil : Réglages, et surtout déconnexion.
 *
 * La suppression passe par le client de session, donc par la RLS : on ne peut
 * effacer que ses propres abonnements. C'est pour cela que la déconnexion
 * appelle `desactiverPush()` AVANT `signOut()` — après, il n'y a plus de
 * session pour autoriser quoi que ce soit.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });
  }

  const endpoint = (body as { endpoint?: string })?.endpoint;
  if (!endpoint) {
    return NextResponse.json({ error: "MISSING_ENDPOINT" }, { status: 400 });
  }

  const { error } = await supabase
    .from("push_subscriptions")
    .delete()
    .eq("endpoint", endpoint);

  if (error) {
    return NextResponse.json({ error: "DELETE_FAILED" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
