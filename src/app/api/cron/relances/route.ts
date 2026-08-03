import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import {
  choisirRelance,
  construireCandidats,
  envoyerRelance,
  type AbonnementPush,
} from "@/services/relances";
import type { Lang } from "@/lib/i18n/config";
import type {
  LigneDocument,
  LigneEntreprise,
  LigneLog,
  LigneProfil,
} from "@/services/relances/collecte";

/** web-push signe avec les primitives Node : pas d'exécution sur l'Edge. */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Fenêtre de journal suffisante pour tous les garde-fous (le plus long : 14 j). */
const HISTORIQUE_JOURS = 30;
/** Plafond par exécution — au-delà, la fonction dépasserait son temps imparti. */
const MAX_UTILISATEURS = 500;

/**
 * Relances push quotidiennes (déclenchée par Vercel Cron, voir vercel.json —
 * `0 8 * * *`, soit 9 h au Cameroun : la journée commence, personne n'est
 * réveillé. Le plan Hobby n'autorise qu'un passage par jour, ce qui suffit :
 * les garde-fous anti-répétition vivent dans `select.ts`, pas dans le rythme).
 *
 * Protégée par CRON_SECRET : c'est la seule route capable d'écrire à tous les
 * utilisateurs à la fois. Vercel joint automatiquement ce secret en
 * `Authorization: Bearer …` aux tâches déclarées dans vercel.json.
 *
 * Le travail se fait en trois temps nettement séparés — collecte, décision,
 * envoi — pour que la partie qui décide reste une fonction pure, éprouvée par
 * `select.test.ts`. Une relance mal calibrée ne casse rien visiblement : elle
 * fait couper les notifications, sans retour en arrière possible.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_NOT_CONFIGURED" }, { status: 500 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const service = createServiceClient();
  const maintenant = new Date();

  // 1. Collecte — on ne part QUE des utilisateurs abonnés : sans appareil
  // enregistré, il n'y a rien à envoyer et rien à calculer.
  const { data: abonnements, error: erreurAbos } = await service
    .from("push_subscriptions")
    .select("id, user_id, endpoint, p256dh, auth, lang");

  if (erreurAbos) {
    return NextResponse.json({ error: "SUBSCRIPTIONS_READ_FAILED" }, { status: 500 });
  }
  if (!abonnements?.length) {
    return NextResponse.json({ ok: true, candidats: 0, envoyees: 0 });
  }

  const abonnementsParUtilisateur = new Map<string, AbonnementPush[]>();
  const langues = new Map<string, Lang>();
  for (const a of abonnements) {
    const liste = abonnementsParUtilisateur.get(a.user_id) ?? [];
    liste.push({
      id: a.id,
      endpoint: a.endpoint,
      p256dh: a.p256dh,
      auth: a.auth,
      lang: a.lang,
    });
    abonnementsParUtilisateur.set(a.user_id, liste);
    if (!langues.has(a.user_id)) langues.set(a.user_id, a.lang === "en" ? "en" : "fr");
  }

  const userIds = [...abonnementsParUtilisateur.keys()].slice(0, MAX_UTILISATEURS);
  const depuis = new Date(
    maintenant.getTime() - HISTORIQUE_JOURS * 24 * 3600 * 1000,
  ).toISOString();

  const [profils, entreprises, logs] = await Promise.all([
    service
      .from("profiles")
      .select("id, created_at, last_seen_at")
      .in("id", userIds)
      .is("deleted_at", null),
    service
      .from("companies")
      .select("id, owner_id, suspended_at")
      .in("owner_id", userIds)
      .is("deleted_at", null),
    service
      .from("relance_logs")
      .select("user_id, kind, document_id, sent_at")
      .in("user_id", userIds)
      .gte("sent_at", depuis),
  ]);

  const companyIds = (entreprises.data ?? []).map((e) => e.id);
  const documents = companyIds.length
    ? await service
        .from("documents")
        .select("id, company_id, type, status, number, client_name, total, issue_date")
        .in("company_id", companyIds)
        .is("deleted_at", null)
    : { data: [] as LigneDocument[] };

  // 2. Décision — pure, sans effet de bord.
  const candidats = construireCandidats({
    profils: (profils.data ?? []) as LigneProfil[],
    entreprises: (entreprises.data ?? []) as LigneEntreprise[],
    documents: (documents.data ?? []) as LigneDocument[],
    logs: (logs.data ?? []) as LigneLog[],
    langues,
  });

  const relances = candidats
    .map((c) => choisirRelance(c, maintenant))
    .filter((r): r is NonNullable<typeof r> => r !== null);

  // 3. Envoi — un utilisateur reçoit la relance sur TOUS ses appareils, mais
  // elle n'est journalisée qu'une fois : c'est bien une relance, pas trois.
  let envoyees = 0;
  let expirees = 0;

  for (const relance of relances) {
    const appareils = abonnementsParUtilisateur.get(relance.userId) ?? [];
    let auMoinsUn = false;

    for (const appareil of appareils) {
      const resultat = await envoyerRelance(appareil, relance);

      if (resultat.statut === "envoye") {
        auMoinsUn = true;
        await service
          .from("push_subscriptions")
          .update({ last_success_at: maintenant.toISOString(), failure_count: 0 })
          .eq("id", appareil.id);
      } else if (resultat.statut === "expire") {
        expirees += 1;
        await service.from("push_subscriptions").delete().eq("id", appareil.id);
      } else {
        // Panne passagère du service de push : on compte l'échec. L'abonnement
        // n'est abandonné qu'au bout de plusieurs jours consécutifs (la
        // fonction s'en charge), jamais sur un seul incident réseau.
        await service.rpc("bump_push_failure", { p_subscription_id: appareil.id });
      }
    }

    if (auMoinsUn) {
      envoyees += 1;
      await service.from("relance_logs").insert({
        user_id: relance.userId,
        kind: relance.kind,
        document_id: relance.documentId,
      });
    }
  }

  return NextResponse.json({
    ok: true,
    candidats: candidats.length,
    choisies: relances.length,
    envoyees,
    abonnementsExpires: expirees,
  });
}
