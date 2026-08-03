import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * Enregistre un appareil pour les relances push.
 *
 * L'utilisateur est identifié par sa session — jamais par le corps de la
 * requête. L'écriture passe ensuite par la clé de service pour une seule
 * raison : un même appareil peut déjà être enregistré au nom d'un autre
 * compte (téléphone prêté, changement de propriétaire). Il faut alors
 * *réattribuer* la ligne, ce que la RLS interdit à juste titre au client.
 * Seul `user_id`, issu de la session vérifiée, décide du destinataire.
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

  const { subscription, lang } = (body ?? {}) as {
    subscription?: { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
    lang?: string;
  };

  const endpoint = subscription?.endpoint;
  const p256dh = subscription?.keys?.p256dh;
  const auth = subscription?.keys?.auth;

  if (!endpoint || !p256dh || !auth) {
    return NextResponse.json({ error: "INVALID_SUBSCRIPTION" }, { status: 400 });
  }

  const service = createServiceClient();
  const { error } = await service.from("push_subscriptions").upsert(
    {
      user_id: user.id,
      endpoint,
      p256dh,
      auth,
      lang: lang === "en" ? "en" : "fr",
      user_agent: request.headers.get("user-agent")?.slice(0, 300) ?? null,
      // Un réabonnement repart d'une ardoise propre : les échecs comptés
      // concernaient l'ancien enregistrement.
      failure_count: 0,
    },
    { onConflict: "endpoint" },
  );

  if (error) {
    return NextResponse.json({ error: "SAVE_FAILED" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
